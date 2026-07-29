import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type AnvilDeployment = {
  chainId: number;
  demoAccount: string;
  tokens: Record<string, string>;
  MockSwapRouter: string;
};

const fallback: AnvilDeployment = {
  chainId: 31337,
  demoAccount: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  tokens: {
    MOCK_USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    MOCK_ETH: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  MockSwapRouter: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

export function loadAnvilDeployment(): AnvilDeployment {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const p = path.resolve(here, "../../../../contracts/deployments/anvil.json");
    return JSON.parse(readFileSync(p, "utf8")) as AnvilDeployment;
  } catch {
    return fallback;
  }
}
