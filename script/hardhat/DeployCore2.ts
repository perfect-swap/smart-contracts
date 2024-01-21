import { deploy, deployLibrary, getContractAt } from "./utils/helpers";
import deployedContracts from "../constants/output/ProtocolOutput.json";
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
  // AirdropDistributor,
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
  // AirdropDistributor: string;
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
  // ====== start get contract() ======
  const DECIMAL = BigNumber.from(10).pow(18);


  const PRFCT_Add = '0xEc0bC0A72f93a200e21504DE3f4d87307d3B4263'
  const implementation_Add = '0x130D8F7044be97DDEeC58Dba15bc20FFC245175a'
  const poolFactory_Add = '0xFA8Ad262605A89B2072E00009F9Bb88276eC439a'
  const votingRewardsFactory_Add = '0xC0CD40e32d8C11ECF4Ff570f2d31d7AF9d5D077a'
  const gaugeFactory_Add = '0x17F7505dA18cFf788DEfAcFcfA47111ad9de64B4'
  

  const PRFCT = await getContractAt<Prfct>("Prfct", PRFCT_Add );
  console.log("PRFCT: ", PRFCT.address)
  jsonConstants.whitelistTokens.push(PRFCT.address);
  // console.log("jsonConstants: ", jsonConstants.whitelistTokens )
  
  const implementation = await getContractAt<Pool>("Pool",implementation_Add);
  console.log("Implementation: ", implementation.address)

  const poolFactory = await getContractAt<PoolFactory>(
    "PoolFactory",poolFactory_Add
  );
  console.log("poolFactory: ", poolFactory.address)

  const votingRewardsFactory = await getContractAt<VotingRewardsFactory>(
    "VotingRewardsFactory",votingRewardsFactory_Add
  );
  console.log("votingRewardsFactory: ", votingRewardsFactory.address)
  const gaugeFactory = await getContractAt<GaugeFactory>("GaugeFactory",gaugeFactory_Add);
  console.log("gaugeFactory: ", gaugeFactory.address)

  //--------- Start Deploy ------------

  const managedRewardsFactory = await deploy<ManagedRewardsFactory>(
    "ManagedRewardsFactory"
  );
  console.log("managedRewardsFactory: ", managedRewardsFactory.address)

  const factoryRegistry = await deploy<FactoryRegistry>(
    "FactoryRegistry",
    undefined,
    poolFactory.address,
    votingRewardsFactory.address,
    gaugeFactory.address,
    managedRewardsFactory.address
  );
  console.log("factoryRegistry: ", factoryRegistry.address)
  // ====== end deployFactories() ======

  const forwarder = await deploy<ProtocolForwarder>("ProtocolForwarder");
  console.log("forwarder: ", forwarder.address)




  const balanceLogicLibrary = await deployLibrary("BalanceLogicLibrary");
  console.log("balanceLogicLibrary: ", balanceLogicLibrary.address)
  const delegationLogicLibrary = await deployLibrary("DelegationLogicLibrary");
  console.log("delegationLogicLibrary: ", delegationLogicLibrary.address)
  const libraries: Libraries = {
    BalanceLogicLibrary: balanceLogicLibrary.address,
    DelegationLogicLibrary: delegationLogicLibrary.address,
  };

  const escrow = await deploy<VotingEscrow>(
    "VotingEscrow",
    libraries,
    forwarder.address,
    PRFCT.address,
    factoryRegistry.address
  );
  console.log("VotingEscrow: ", escrow.address)

  const trig = await deployLibrary("Trig");
  console.log("trig: ", trig.address)
  const perlinNoise = await deployLibrary("PerlinNoise");
  console.log("perlinNoise: ", perlinNoise.address)
  const artLibraries: Libraries = {
    Trig: trig.address,
    PerlinNoise: perlinNoise.address,
  };

  const artProxy = await deploy<VeArtProxy>(
    "VeArtProxy",
    artLibraries,
    escrow.address
  );
  console.log("artProxy: ", artProxy.address)


  await escrow.setArtProxy(artProxy.address);

  const distributor = await deploy<RewardsDistributor>(
    "RewardsDistributor",
    undefined,
    escrow.address
  );
  console.log("RewardsDistributor: ", distributor.address)

  const voter = await deploy<Voter>(
    "Voter",
    undefined,
    forwarder.address,
    escrow.address,
    factoryRegistry.address
  );
  console.log("voter: ", voter.address)

  await escrow.setVoterAndDistributor(voter.address, distributor.address);

  const router = await deploy<Router>(
    "Router",
    undefined,
    forwarder.address,
    factoryRegistry.address,
    poolFactory.address,
    voter.address,
    jsonConstants.WETH
  );
  console.log("router: ", router.address)

  const minter = await deploy<Minter>(
    "Minter",
    undefined,
    voter.address,
    escrow.address,
    distributor.address
  );
  console.log("minter: ", minter.address)
  await distributor.setMinter(minter.address);
  await PRFCT.setMinter(minter.address);

  // const airdrop = await deploy<AirdropDistributor>(
  //   "AirdropDistributor",
  //   undefined,
  //   escrow.address
  // );
  // console.log("AirdropDistributor: ", airdrop.address)

  await voter.initialize(jsonConstants.whitelistTokens, minter.address);
  // ====== end _coreSetup() ======

  // ====== start _deploySetupAfter() ======

  // Minter initialization
  let lockedAirdropInfo: AirdropInfo[] = jsonConstants.minter.locked;
  let liquidAirdropInfo: AirdropInfo[] = jsonConstants.minter.liquid;

  let liquidWallets: string[] = [];
  let lockedWallets: string[] = [];
  let liquidAmounts: BigNumber[] = [];
  let lockedAmounts: BigNumber[] = [];

  // First add the AirdropDistributor's address and its amount
  // liquidWallets.push(airdrop.address);
  // liquidAmounts.push(BigNumber.from(AIRDROPPER_BALANCE).mul(DECIMAL));

  liquidAirdropInfo.forEach((drop) => {
    liquidWallets.push(drop.wallet);
    liquidAmounts.push(BigNumber.from(drop.amount / 1e18).mul(DECIMAL));
  });

  lockedAirdropInfo.forEach((drop) => {
    lockedWallets.push(drop.wallet);
    lockedAmounts.push(BigNumber.from(drop.amount / 1e18).mul(DECIMAL));
  });

  await minter.initialize({
    liquidWallets: liquidWallets,
    liquidAmounts: liquidAmounts,
    lockedWallets: lockedWallets,
    lockedAmounts: lockedAmounts,
  });

  // Set protocol state to team
  await escrow.setTeam(jsonConstants.team);
  await minter.setTeam(jsonConstants.team);
  await poolFactory.setPauser(jsonConstants.team);
  await voter.setEmergencyCouncil(jsonConstants.team);
  await voter.setEpochGovernor(jsonConstants.team);
  await voter.setGovernor(jsonConstants.team);
  await factoryRegistry.transferOwnership(jsonConstants.team);

  await poolFactory.setFeeManager(jsonConstants.feeManager);
  await poolFactory.setVoter(voter.address);

  // ====== end _deploySetupAfter() ======

  const outputDirectory = "script/constants/output";
  const outputFile = join(
    process.cwd(),
    outputDirectory,
    "ProtocolOutput.json"
  );

  const output: ProtocolOutput = {
    // AirdropDistributor: airdrop.address,
    ArtProxy: artProxy.address,
    Distributor: distributor.address,
    FactoryRegistry: factoryRegistry.address,
    Forwarder: forwarder.address,
    GaugeFactory: gaugeFactory.address,
    ManagedRewardsFactory: managedRewardsFactory.address,
    Minter: minter.address,
    PoolFactory: poolFactory.address,
    Router: router.address,
    PRFCT: PRFCT.address,
    Voter: voter.address,
    VotingEscrow: escrow.address,
    VotingRewardsFactory: votingRewardsFactory.address,
  };

  try {
    await writeFile(outputFile, JSON.stringify(output, null, 2));
  } catch (err) {
    console.error(`Error writing output file: ${err}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
