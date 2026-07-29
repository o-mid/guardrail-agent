// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockSwapRouter} from "../src/MockSwapRouter.sol";

contract MockTokensTest is Test {
    MockERC20 usdc;
    MockERC20 eth;
    MockSwapRouter router;

    function setUp() public {
        usdc = new MockERC20("Mock USDC", "MOCK_USDC");
        eth = new MockERC20("Mock ETH", "MOCK_ETH");
        router = new MockSwapRouter(1e15);
        usdc.mint(address(this), 1000 ether);
        eth.mint(address(router), 1000 ether);
    }

    function testTransfer() public {
        address to = address(0x1111111111111111111111111111111111111111);
        usdc.transfer(to, 5 ether);
        assertEq(usdc.balanceOf(to), 5 ether);
    }

    function testApproveAndSwap() public {
        usdc.approve(address(router), 10 ether);
        uint256 out = router.swapExactIn(address(usdc), address(eth), 10 ether, 1);
        assertGt(out, 0);
    }
}
