import { deploy, deployLibrary, getContractAt } from "./utils/helpers";
import { writeFile } from "fs/promises";
import { join } from "path";
import { Libraries } from "hardhat/types";
import { BigNumber } from "ethers";
import {
  ManagedRewardsFactory,
  VotingRewardsFactory,
  GaugeFactory,
  PoolFactory,
  FactoryRegistry,
  Pool,
  Minter,
  RewardsDistributor,
  AirdropDistributor,
  Router,
  Prfct,
  Voter,
  VeArtProxy,
  VotingEscrow,
  IERC20,
  ProtocolForwarder,
} from "../../artifacts/types";
import jsonConstants from "../constants/Base.json";

interface ProtocolOutput {
  AirdropDistributor: string;
  ArtProxy: string;
  Distributor: string;
  FactoryRegistry: string;
  Forwarder: string;
  GaugeFactory: string;
  ManagedRewardsFactory: string;
  Minter: string;
  PoolFactory: string;
  Router: string;
  PRFCT: string;
  Voter: string;
  VotingEscrow: string;
  VotingRewardsFactory: string;
}

interface AirdropInfo {
  amount: number;
  wallet: string;
}

async function main() {
  // ====== start _deploySetupBefore() ======

  const PRFCT = await deploy<Prfct>("Prfct");
  console.log("PRFCT: ", PRFCT.address)
  jsonConstants.whitelistTokens.push(PRFCT.address);

  const implementation = await deploy<Pool>("Pool");
  console.log("Implementation: ", implementation.address)

  const poolFactory = await deploy<PoolFactory>(
    "PoolFactory",
    undefined,
    implementation.address
  );
  console.log("poolFactory: ", poolFactory.address)
  await poolFactory.setFee(true, 1);
  await poolFactory.setFee(false, 1);

  const votingRewardsFactory = await deploy<VotingRewardsFactory>(
    "VotingRewardsFactory"
  );
  console.log("votingRewardsFactory: ", votingRewardsFactory.address)

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
