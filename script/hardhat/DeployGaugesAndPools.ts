import { getContractAt } from "./utils/helpers";
import { PoolFactory, Voter } from "../../artifacts/types";
import jsonConstants from "../constants/Base.json";
import deployedContracts from "../constants/output/ProtocolOutput.json";

async function main() {
  const factory = await getContractAt<PoolFactory>(
    "PoolFactory",
    deployedContracts.PoolFactory
  );
  const voter = await getContractAt<Voter>("Voter", deployedContracts.Voter);

  // Deploy non-PRFCT pools and gauges
  for (var i = 0; i < jsonConstants.pools.length; i++) {
    const { stable, tokenA, tokenB } = jsonConstants.pools[i];
    await factory.functions["createPool(address,address,bool)"](
      tokenA,
      tokenB,
      stable,
      { gasLimit: 5000000 }
    );
    let pool = await factory.functions["getPool(address,address,bool)"](
      tokenA,
      tokenB,
      stable
    );
    await voter.createGauge(
      deployedContracts.PoolFactory, // PoolFactory
      pool[0],
      { gasLimit: 500000000 }
    );

    const gauge_A_B = await voter.functions["gauges(address)"](
      pool[0]
    );
    console.log(tokenA, tokenB, stable, pool[0],gauge_A_B[0])
  }

  // Deploy PRFCT pools and gauges
  for (var i = 0; i < jsonConstants.poolsPrfct.length; i++) {
    const [stable, token] = Object.values(jsonConstants.poolsPrfct[i]);
    await factory.functions["createPool(address,address,bool)"](
      deployedContracts.PRFCT,
      token,
      stable,
      {
        gasLimit: 5000000,
      }
    );
    let pool = await factory.functions["getPool(address,address,bool)"](
      deployedContracts.PRFCT,
      token,
      stable
    );
    await voter.createGauge(
      deployedContracts.PoolFactory, // PoolFactory
      pool[0]
      ,{
        gasLimit: 500000000,
      }
    );
    const gauge_PRFCT_token = await voter.functions["gauges(address)"](
      pool[0]
    );
    console.log('PRFCT', token, stable, pool[0], gauge_PRFCT_token[0])
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
