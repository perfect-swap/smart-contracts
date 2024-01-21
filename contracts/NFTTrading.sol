// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import {IVotingEscrow} from "./interfaces/IVotingEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract NFTTrade is ReentrancyGuard, Ownable {
    receive() external payable {}
    IVotingEscrow public immutable ve;
    using SafeERC20 for IERC20;
    uint256 TRADINGFEERATE = 1; // 1% trading fee

    struct NFTList{
        address seller;
        uint256 tokenId;
        address buy_token;
        uint256 buy_price;
    }
    NFTList[] public nftList;

    constructor(address _ve) {
        ve = IVotingEscrow(_ve);
    }


    function getNFTIndexByTokenId( uint256 _tokenId ) public view returns(uint256) {
        uint256 _length = nftList.length;
        uint256 _index = _length;
        for( uint256 i = 0 ; i < _length ; i++ ){
            if(nftList[i].tokenId == _tokenId){
                _index = i;
                break ;
            }
        }
        require(_index != _length, "Not found the tokenId");
        return _index;
    }

    function removeListItem(uint256 _index) internal {
        uint256 _length = nftList.length;
        require(_index < _length, " List Index is overflow length");
        nftList[_index] = nftList[_length-1];
        nftList.pop();
    }

    function listNFT( uint256 _tokenId, address _token, uint256 _buy_price ) external nonReentrant  {
        address sender = msg.sender;
        require(_buy_price>0, "Price can't be zero");
        bool isAllowed = ve.isApprovedOrOwner(address(this), _tokenId); // updated
        require(isAllowed, "Not Approved");
        ve.transferFrom(sender, address(this), _tokenId);
        nftList.push( NFTList({
            seller: sender,
            tokenId: _tokenId,
            buy_token: _token,
            buy_price: _buy_price
        })
        );
    }

    function updatelistNFT( uint256 _tokenId, address _token, uint256 _buy_price ) external nonReentrant  {
        address sender = msg.sender;
        require(_buy_price>0, "Price can't be zero");
        uint256 _index = getNFTIndexByTokenId(_tokenId);
        bool isAllowed = nftList[_index].seller ==  sender;
        require(isAllowed, "Not the Seller");
        nftList[_index].buy_token = _token;
        nftList[_index].buy_price = _buy_price;
    }

    function unlistNFT( uint256 _tokenId ) external nonReentrant {
        uint256 _index = getNFTIndexByTokenId(_tokenId);
        require(nftList[_index].seller ==  msg.sender, "Not Seller"); 
        removeListItem(_index);
        ve.transferFrom(address(this), msg.sender, _tokenId);
    }

    function buyNFTByETH( uint256 _tokenId ) external payable nonReentrant {
        uint256 _index = getNFTIndexByTokenId(_tokenId);
        uint256 eth_amount = msg.value;
        require(nftList[_index].buy_token == address(0),"buying coin is not ETH");
        require(eth_amount == nftList[_index].buy_price, "ETH value incorrect");
        uint256 fee_amount = eth_amount * TRADINGFEERATE / 100 ;
        uint256 to_seller_amount = eth_amount - fee_amount;
        address payable _seller = payable(nftList[_index].seller);
        address payable _owner = payable(owner());
        _owner.transfer(fee_amount);
        _seller.transfer(to_seller_amount);
        ve.transferFrom(address(this), msg.sender,  _tokenId);
        removeListItem(_index);
    }

    function buyNFTByToken( uint256 _tokenId ) external nonReentrant {
        uint256 _index = getNFTIndexByTokenId(_tokenId);
        address _buy_token = nftList[_index].buy_token;
        uint256 _buy_price = nftList[_index].buy_price;
        uint256 fee_amount = _buy_price * TRADINGFEERATE / 100 ;
        uint256 to_seller_amount = _buy_price - fee_amount;
        IERC20(_buy_token).safeTransferFrom(msg.sender, owner(), fee_amount);
        IERC20(_buy_token).safeTransferFrom(msg.sender, nftList[_index].seller, to_seller_amount);

        ve.transferFrom(address(this), msg.sender,  _tokenId);
        removeListItem(_index);
    }
    function getAllList() public  view returns(NFTList[] memory){
        return nftList;
    }
    function getLengthList() public view returns(uint256){
        return nftList.length;
    }
}
