// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import "forge-std/StdJson.sol";
import "../test/Base.sol";

/// @notice Deploy script to deploy new pools and gauges
contract DeployGaugesAndPools is Script {
    using stdJson for string;

    uint256 public deployPrivateKey = vm.envUint("PRIVATE_KEY_DEPLOY");
    address public deployerAddress = vm.rememberKey(deployPrivateKey);
    string public constantsFilename = vm.envString("CONSTANTS_FILENAME");
    string public outputFilename = vm.envString("OUTPUT_FILENAME");
    string public jsonConstants;
    string public jsonOutput;

    PoolFactory public factory;
    Voter public voter;
    address public PRFCT;

    struct PoolNonPrfct {
        bool stable;
        address tokenA;
        address tokenB;
    }

    struct PoolPrfct {
        bool stable;
        address token;
    }

    address[] pools;
    address[] gauges;

    constructor() {}

    function run() public {
        string memory root = vm.projectRoot();
        string memory basePath = string.concat(root, "/script/constants/");
        string memory path = string.concat(basePath, constantsFilename);

        // load in vars
        jsonConstants = vm.readFile(path);
        PoolNonPrfct[] memory _pools = abi.decode(jsonConstants.parseRaw(".pools"), (PoolNonPrfct[]));
        PoolPrfct[] memory poolsPrfct = abi.decode(jsonConstants.parseRaw(".poolsPrfct"), (PoolPrfct[]));

        path = string.concat(basePath, "output/DeployCore-");
        path = string.concat(path, outputFilename);
        jsonOutput = vm.readFile(path);
        factory = PoolFactory(abi.decode(jsonOutput.parseRaw(".PoolFactory"), (address)));
        voter = Voter(abi.decode(jsonOutput.parseRaw(".Voter"), (address)));
        PRFCT = abi.decode(jsonOutput.parseRaw(".PRFCT"), (address));

        vm.startBroadcast(deployerAddress);

        // Deploy all non-PRFCT pools & gauges
        for (uint256 i = 0; i < _pools.length; i++) {
            address newPool = factory.createPool(_pools[i].tokenA, _pools[i].tokenB, _pools[i].stable);
            address newGauge = voter.createGauge(address(factory), newPool);

            pools.push(newPool);
            gauges.push(newGauge);
        }

        // Deploy all PRFCT pools & gauges
        for (uint256 i = 0; i < poolsPrfct.length; i++) {
            address newPool = factory.createPool(PRFCT, poolsPrfct[i].token, poolsPrfct[i].stable);
            address newGauge = voter.createGauge(address(factory), newPool);

            pools.push(newPool);
            gauges.push(newGauge);
        }

        vm.stopBroadcast();

        // Write to file
        path = string.concat(basePath, "output/DeployGaugesAndPools-");
        path = string.concat(path, outputFilename);
        vm.writeJson(vm.serializeAddress("v2", "gaugesPools", gauges), path);
        vm.writeJson(vm.serializeAddress("v2", "pools", pools), path);
    }
}
