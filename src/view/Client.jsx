import React, { Component } from 'react';
import Axios from "axios";

import NoResult from './NoResult';
import { getRoute, routes } from "./routes";

class Client extends Component {
    constructor(props) {
        super(props);
        this.state = {
            data: null,
        };
    }

    componentDidMount() {
        Axios.get('/api/v1/clients')
            .then(({data}) => {
                if (!!data) {
                    this.setState({ data, isReady: true });
                }
                this.setState({ isReady: true });
            });
    }

    render() {
        const { isReady, data } = this.state;
        if (!isReady) {
            return null;
        }
        return (
            <div className="column">
                <div className="d-flex align-items-center">
                    <h4 className="p-2 m-t-30 m-b-15">Clients</h4>
                </div>
                <div className="mb-4 flex-table col-md-7 col-sm-12">
                    <table width="100%">
                        <thead>
                        <tr className="head-table-row">
                            <th className="lh2rem">Pos.</th>
                            <th className="lh2rem">Commitment</th>
                        </tr>
                        </thead>
                        <tbody>
                        {data.map(data =>
                            <tr key={data.position}>
                                <td>{data.position}</td>
                                <td colSpan="2">
                                    <a href={getRoute(routes.commitment, { value: data.commitment || '/'})}>
                                        <span className="hash truncate-hash">{data.commitment}</span>
                                    </a>
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
}

export default Client;
