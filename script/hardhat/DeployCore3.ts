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


  const PRFCT_Add = '0x9C04650C44c06749a12F6C48bB04C21F2b290B1d'
  const implementation_Add = '0xC8dF4EDE857399d791F6330bCF05A4293C8Fc6a2'
  const poolFactory_Add = '0xA0F6bEe0479D0f008CA29513038F9ACCcfEFb72F'
  const votingRewardsFactory_Add = '0xE4a88Bd96120F58c72B1Da4FDB6E76f17775C2Fc'
  const gaugeFactory_Add = '0x90e58Cd1eefdD2cA5775Eb37C415fbcbc5B5F818'
  const managedRewardsFactory_Add = '0x6DCb7E5CA4CFad27550eD49F94D76b833Ef621C5'
  const factoryRegistry_Add = '0xa4b9DE677a95929a1A900a187F9e15489b0982F0'
  const forwarder_Add = '0x6FBcC036Af5a6264D24Ae28A403B157A2D7F7159'

  

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

  const managedRewardsFactory = await getContractAt<ManagedRewardsFactory>(
    "ManagedRewardsFactory",managedRewardsFactory_Add
  );
  console.log("managedRewardsFactory: ", managedRewardsFactory.address)

  const factoryRegistry = await getContractAt<FactoryRegistry>(
    "FactoryRegistry", factoryRegistry_Add
  );
  console.log("factoryRegistry: ", factoryRegistry.address)
  // ====== end deployFactories() ======

  const forwarder = await getContractAt<ProtocolForwarder>("ProtocolForwarder",forwarder_Add);
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
