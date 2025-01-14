// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

abstract contract IPipInterface {
    function read() public virtual returns (bytes32);
    function poke() external virtual;
}
