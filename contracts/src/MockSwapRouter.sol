// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @notice Fixed-rate demo router. Rate is tokenOut per 1e18 of tokenIn.
contract MockSwapRouter {
    uint256 public immutable rateWad;

    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(uint256 rateWad_) {
        require(rateWad_ > 0, "MockSwapRouter: zero rate");
        rateWad = rateWad_;
    }

    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "MockSwapRouter: zero amount");
        amountOut = (amountIn * rateWad) / 1e18;
        require(amountOut >= minAmountOut, "MockSwapRouter: slippage");

        require(IERC20Like(tokenIn).transferFrom(msg.sender, address(this), amountIn), "MockSwapRouter: pull in");
        require(IERC20Like(tokenOut).transfer(msg.sender, amountOut), "MockSwapRouter: push out");

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}
