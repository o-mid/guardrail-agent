// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockSwapRouter} from "../src/MockSwapRouter.sol";

contract DeployMocks is Script {
    function run() external returns (address usdc, address weth, address router) {
        vm.startBroadcast();
        MockERC20 usdcToken = new MockERC20("Mock USDC", "MOCK_USDC");
        MockERC20 wethToken = new MockERC20("Mock ETH", "MOCK_ETH");
        MockSwapRouter swapRouter = new MockSwapRouter(1e15);

        address demo = msg.sender;
        usdcToken.mint(demo, 1_000_000 ether);
        wethToken.mint(address(swapRouter), 1_000_000 ether);

        vm.stopBroadcast();

        usdc = address(usdcToken);
        weth = address(wethToken);
        router = address(swapRouter);

        console2.log("MOCK_USDC", usdc);
        console2.log("MOCK_ETH", weth);
        console2.log("MockSwapRouter", router);
    }
}
