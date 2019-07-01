import Axios from "axios";
import React, { Component } from "react";
import NotFound from './NotFound';
import { getRoute, routes } from './routes';
import Flag from "./Flag";

class Blockhash extends Component {
    constructor(props) {
        super(props);
        this.state = {
            data: null,
            isReady: false,
        }
    }

    componentDidMount() {
        Axios.get("/api/v1/blockhash?hash=" + this.props.match.params.value)
            .then(({ data, error }) => {
                if (data?.response) {
                    this.setState({ data: data.response, isReady: true });
                }
                this.setState({ isReady: true });
            });
    }

    render() {
        const { isReady, data } = this.state;
        if (!isReady) {
            return null;
        }
        if (!data) {
            const errorMessage = `A block with ${this.props.match.params.value} hash does not exist`;
            return <NotFound message={errorMessage} />;
        }
        const { blockhash: {blockhash, txid, confirmed, amount, time} } = data;
        return (
            <div className="row">
            <div className="col-lg-7 col-sm-12">
                <h4 className="p-2 m-t-30 m-b-15 customTitleStyle">Block</h4>
                <div className="flex-table">
                    <table className="main-second-position-block block" width="100%">
                        <tbody>
                        <tr>
                            <th>BlockHash</th>
                            <td colSpan="2"><span className="hash truncate-hash">{blockhash}</span></td>
                        </tr>
                        <tr>
                            <th>TxID</th>
                            <td colSpan="2">
                                <a href={getRoute(routes.transation, {value: txid})}>
                                    <span className="hash truncate-hash">{txid}</span>
                                </a>
                                <Flag
                                    label={confirmed ? 'Confirmed' : 'Pending'}
                                    viewType={confirmed ? 'success': 'info'}
                                    className="m-l-15"
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>Amount</th>
                            <td>{amount} BTC</td>
                        </tr>
                        <tr>
                            <th>Time</th>
                            <td>{time}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        );
    }
}

export default Blockhash;
