import React from 'react';
import PriceCBT from './PriceCBT';
import TotalSupplyCBT from './totalSupplyCBT';
import LatestAttestationInfo from './LatestAttestationInfo';


const MainstayInfo = () => (
    <div className="col-md-6">
        <div className="d-flex align-items-center">
            <h3 className="mt-2">Mainstay</h3>
        </div>
        <div>
            <div className="mb-3 col">
                {/*<TotalSupplyCBT/>*/}
                <PriceCBT/>
                <LatestAttestationInfo/>
            </div>
        </div>
    </div>
);

export default MainstayInfo;