// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;

import "../auth/AdminAuth.sol";
import "../actions/mcd/helpers/McdRatioHelper.sol";
import "../interfaces/ITrigger.sol";

contract McdRatioTrigger is ITrigger, AdminAuth, McdRatioHelper {

    enum RatioState { OVER, UNDER }
    struct CallParams {
        uint256 nextPrice;
    }
    struct SubParams {
        uint64 vaultId;
        uint64 ratio;
        uint8 state;
    }

    function isTriggered(bytes memory _callData, bytes memory _subData)
        public
        view
        override
        returns (bool)
    {
        CallParams memory callInputData = parseCallInputs(_callData);
        SubParams memory subInputData = parseSubInputs(_subData);

        uint256 currRatio = getRatio(subInputData.vaultId, callInputData.nextPrice); // GAS 50k

        // TODO: validation for nextPrice?

        if (RatioState(subInputData.state) == RatioState.OVER) {
            if (currRatio > subInputData.ratio) return true;
        }

        if (RatioState(subInputData.state) == RatioState.UNDER) {
            if (currRatio < subInputData.ratio) return true;
        }

        return false;
    }

    function parseSubInputs(bytes memory _subData) internal pure returns (SubParams memory params) {
        bytes8 _vaultId;
        bytes8 _ratio;
        bytes1 _state;

        assembly {
            _vaultId := mload(add(_subData, 0x20))
            _ratio := mload(add(_subData, add(0x20, 8)))
            _state := mload(add(_subData, add(0x20, 16)))
        }

        params.vaultId = uint64(_vaultId);
        params.ratio = uint64(_ratio);
        params.state = uint8(_state);
    }

    function parseCallInputs(bytes memory _callData) internal pure returns (CallParams memory params) {
        params = abi.decode(_callData, (CallParams));
    }

}
