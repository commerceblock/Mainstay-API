const models = require('../models/models');
const elliptic = require('elliptic');
const {base64decode} = require('nodejs-base64');
const moment = require('moment');

const ec = new elliptic.ec('secp256k1');
const { MerkleTree } = require('merkletreejs')
const SHA256 = require('crypto-js/sha256')
var CryptoJS = require('crypto-js')

const {
    VERSION_API_V1,
    INTERNAL_ERROR_API,
    POSITION_UNKNOWN,
    COMMITMENT_POSITION_UNKNOWN,
    MERKLEROOT_UNKNOWN,
    BAD_ARG_PAYLOAD,
    MISSING_ARG_PAYLOAD,
    MAINSTAY_PAYLOAD,
    MAINSTAY_SIGNATURE,
    MISSING_PAYLOAD_COMMITMENT,
    MISSING_PAYLOAD_POSITION,
    MISSING_ARG_SIGNATURE,
    MISSING_PAYLOAD_TOKEN,
    PAYLOAD_TOKEN_ERROR,
    SIGNATURE_INVALID,
    TXID_UNKNOWN
} = require('../utils/constants');

const {
    get_hash_arg,
    get_txid_arg,
    get_commitment_arg,
    get_merkle_root_arg,
    get_position_arg,
    start_time,
    reply_err,
    reply_msg,
} = require('../utils/controller_helpers');

const DATE_FORMAT = 'HH:mm:ss L z';

module.exports = {
    index: (req, res) => {
        const startTime = start_time();
        reply_msg(res, VERSION_API_V1, startTime);
    },

    latest_attestation: async (req, res) => {
        const startTime = start_time();
        try {
            const data = await models.attestation.find({confirmed: true}).sort({inserted_at: -1}).limit(1).exec();
            if (data.length === 0) {
                reply_msg(res, {}, startTime);
            } else {
                reply_msg(res, {
                    merkle_root: data[0].merkle_root,
                    txid: data[0].txid
                }, startTime);
            }
        } catch (error) {
            reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    latest_commitment: async (req, res) => {
        let startTime = start_time();
        let position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const attestationData = await models.attestation.find({confirmed: true}).sort({inserted_at: -1}).limit(1).exec();
            if (attestationData.length === 0) {
                return reply_msg(res, {}, startTime);
            }
            const txid = attestationData[0].txid;
            const merkle_root = attestationData[0].merkle_root;

            const merkleCommitmentData = await models.merkleCommitment.find({
                client_position: position,
                merkle_root: merkle_root
            });
            if (merkleCommitmentData.length === 0) {
                return reply_err(res, POSITION_UNKNOWN, startTime);
            }

            //sen success response
            reply_msg(res, {
                commitment: merkleCommitmentData[0].commitment,
                merkle_root: merkle_root,
                txid: txid
            }, startTime);

        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    commitment: async (req, res) => {
        const startTime = start_time();
        const position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }
        const merkle_root = get_merkle_root_arg(req, res, startTime);
        if (merkle_root === undefined) {
            return;
        }

        try {
            const merkleCommitmentData = await models.merkleCommitment.find({
                client_position: position,
                merkle_root: merkle_root
            });
            if (merkleCommitmentData.length === 0) {
                return reply_err(res, COMMITMENT_POSITION_UNKNOWN, startTime);
            }
            reply_msg(res, {
                commitment: merkleCommitmentData[0].commitment,
                merkle_root: merkle_root
            }, startTime);

        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    commitment_latest_proof: async (req, res) => {
        const startTime = start_time();
        const position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const attestationData = await models.attestation.find({confirmed: true}).sort({inserted_at: -1}).limit(1).exec();
            const merkle_root = attestationData[0].merkle_root;
            const txid = attestationData[0].txid;

            const merkleProofData = await models.merkleProof.find({
                client_position: position,
                merkle_root: merkle_root
            });
            if (merkleProofData.length === 0) {
                return reply_err(res, POSITION_UNKNOWN, startTime);
            }
            reply_msg(res, {
                txid: txid,
                commitment: merkleProofData[0].commitment,
                merkle_root: merkle_root,
                ops: merkleProofData[0].ops
            }, startTime);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    commitment_verify: async (req, res) => {
        const startTime = start_time();
        let position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        var commitment = get_commitment_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            //search added commitments first
            const slotCommitment = await models.commitmentAdd.find({
                client_position: position,
                addition: commitment
            });

            //if commitment 
            if (slotCommitment.length > 0) {
                if (slotCommitment[0].confirmed) {
                    commitment = slotCommitment[0];
                } else {
                    return reply_err(res, MERKLEROOT_UNKNOWN, startTime);
                }
            }

            const merkleCommitmentData = await models.merkleCommitment.find({
                client_position: position,
                commitment: commitment
            });

            if (merkleCommitmentData.length === 0) {
                return reply_err(res, COMMITMENT_POSITION_UNKNOWN, startTime);
            }
            const merkle_root = merkleCommitmentData[merkleCommitmentData.length - 1].merkle_root;
            const attestationData = await models.attestation.find({merkle_root});

            if (attestationData.length === 0) {
                return reply_err(res, MERKLEROOT_UNKNOWN, startTime);
            }

            reply_msg(res, {confirmed: attestationData[0].confirmed}, startTime);

        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    commitment_proof: async (req, res) => {
        const startTime = start_time();
        let position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        let merkle_root = get_merkle_root_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const data = await models.merkleProof.find({
                client_position: position,
                merkle_root: merkle_root
            });
            if (data.length === 0) {
                return reply_err(res, POSITION_UNKNOWN, startTime);
            }
            reply_msg(res, {
                merkle_root: merkle_root,
                commitment: data[0].commitment,
                ops: data[0].ops
            }, startTime);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    attestation_proof: async (req, res) => {
        const startTime = start_time();
        let position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        const txid = get_txid_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const attestation = await models.attestation.findOne({
                txid: txid
            });
            if (!attestation) {
                return reply_err(res, TXID_UNKNOWN, startTime);
            }
            const merkle_root = attestation.merkle_root;
            const merkleProof = await models.merkleProof.findOne({
                client_position: position,
                merkle_root: merkle_root
            });
            if (!merkleProof) {
                return reply_err(res, POSITION_UNKNOWN, startTime);
            }
            reply_msg(res, {
                txid: txid,
                merkle_root: merkle_root,
                commitment: merkleProof.commitment,
                ops: merkleProof.ops
            }, startTime);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    commitment_send: async (req, res) => {
        const startTime = start_time();
        let rawRequestData = '';
        req.on('data', chunk => {
            rawRequestData += chunk.toString();
        });

        req.on('end', async () => {
            // test payload in base64 format and defined
            let data;
            let payload;
            try {
                data = JSON.parse(rawRequestData);
                payload = JSON.parse(base64decode(data[MAINSTAY_PAYLOAD]));
            } catch (e) {
                return reply_err(res, BAD_ARG_PAYLOAD, startTime);
            }

            if (payload === undefined) {
                return reply_err(res, MISSING_ARG_PAYLOAD, startTime);
            }

            // check payload components are defined
            if (payload.commitment === undefined) {
                return reply_err(res, MISSING_PAYLOAD_COMMITMENT, startTime);
            }
            if (payload.position === undefined) {
                return reply_err(res, MISSING_PAYLOAD_POSITION, startTime);
            }
            if (payload.token === undefined) {
                return reply_err(res, MISSING_PAYLOAD_TOKEN, startTime);
            }

            const signatureCommitment = data[MAINSTAY_SIGNATURE];
            try {
                // try get client details
                const data = await models.clientDetails.find({client_position: payload.position});
                if (data.length === 0) {
                    return reply_err(res, POSITION_UNKNOWN, startTime);
                }
                if (data[0].auth_token !== payload.token) {
                    return reply_err(res, PAYLOAD_TOKEN_ERROR, startTime);
                }

                if (data[0].pubkey && data[0].pubkey !== '') {
                    if (signatureCommitment === undefined) {
                        return reply_err(res, MISSING_ARG_SIGNATURE, startTime);
                    }

                    try {
                        // get pubkey hex
                        const pubkey = ec.keyFromPublic(data[0].pubkey, 'hex');

                        // get base64 signature
                        let sig = Buffer.from(signatureCommitment, 'base64');

                        if (!ec.verify(payload.commitment, sig, pubkey)) {
                            return reply_err(res, SIGNATURE_INVALID, startTime);
                        }
                    } catch (error) {
                        return reply_err(res, SIGNATURE_INVALID, startTime);
                    }
                }

                await models.clientCommitment.findOneAndUpdate({client_position: payload.position}, {commitment: payload.commitment}, {upsert: true});
                reply_msg(res, 'feedback', startTime);

            } catch (error) {
                return reply_err(res, INTERNAL_ERROR_API, startTime);
            }
        });
    },

    commitment_add: async (req, res) => {
        const startTime = start_time();
        let rawRequestData = '';
        req.on('data', chunk => {
            rawRequestData += chunk.toString();
        });

        req.on('end', async () => {
            // test payload in base64 format and defined
            let data;
            let payload;
            try {
                data = JSON.parse(rawRequestData);
                payload = JSON.parse(base64decode(data[MAINSTAY_PAYLOAD]));
            } catch (e) {
                return reply_err(res, BAD_ARG_PAYLOAD, startTime);
            }

            if (payload === undefined) {
                return reply_err(res, MISSING_ARG_PAYLOAD, startTime);
            }

            // check payload components are defined
            if (payload.commitment === undefined) {
                return reply_err(res, MISSING_PAYLOAD_COMMITMENT, startTime);
            }
            if (payload.position === undefined) {
                return reply_err(res, MISSING_PAYLOAD_POSITION, startTime);
            }
            if (payload.token === undefined) {
                return reply_err(res, MISSING_PAYLOAD_TOKEN, startTime);
            }

            const signatureCommitment = data[MAINSTAY_SIGNATURE];
            try {
                // try get client details
                const data = await models.clientDetails.find({client_position: payload.position});
                if (data.length === 0) {
                    return reply_err(res, POSITION_UNKNOWN, startTime);
                }
                if (data[0].auth_token !== payload.token) {
                    return reply_err(res, PAYLOAD_TOKEN_ERROR, startTime);
                }

                if (data[0].pubkey && data[0].pubkey !== '') {
                    if (signatureCommitment === undefined) {
                        return reply_err(res, MISSING_ARG_SIGNATURE, startTime);
                    }

                    try {
                        // get pubkey hex
                        const pubkey = ec.keyFromPublic(data[0].pubkey, 'hex');

                        // get base64 signature
                        let sig = Buffer.from(signatureCommitment, 'base64');

                        if (!ec.verify(payload.commitment, sig, pubkey)) {
                            return reply_err(res, SIGNATURE_INVALID, startTime);
                        }
                    } catch (error) {
                        return reply_err(res, SIGNATURE_INVALID, startTime);
                    }
                }

                const repeatAdd = await models.commitmentAdd.findOne({client_position: payload.position}, {addition: payload.commitment})

                if (repeatAdd) {
                    reply_msg(res, 'repeat commitment: ignored', startTime);
                } else {
                    //add commitment (unconfirmed)
                    await models.commitmentAdd.insertOne({client_position: payload.position}, {addition: payload.commitment}, {confirmed: false}, {commitment: ''}, {inserted_at: Date.now()});
                    //update confirmed status of listed commitments

                    //get all unconfirmed additions
                    const unconfirmed = await models.commitmentAdd.find({client_position: payload.position}, {confirmed: false}).sort({inserted_at: 1}).exec();

                    //get latest attestation
                    const latest_atst = await models.attestation.find({}).sort({inserted_at: 1}).limit(1).exec();

                    //go through list of unconfirmed additions to see which have been confirmed

                    for (var i = 0; i < unconfirmed.length; i++) {
                        leaves = [];
                        for (var j = 0; j <= i; j++ ) {
                            var leaf = CryptoJS.enc.Hex.parse(unconfirmed[j]);
                            leaves.push(leaf)
                        }
                        const tree = new MerkleTree(leaves, SHA256);
                        const root = tree.getRoot().toString('hex');

                        if (root === latest_atst[0]) {
                            for (var j = 0; j <= i; j++ ) {
                                //update addition table to show confirmed
                                await models.commitmentAdd.updateOne({addition: unconfirmed[j]}, {commitment: root, confirmed: true}, {upsert: true});
                            }
                            //commit the root to the ClientCommitment table
                            await models.clientCommitment.findOneAndUpdate({client_position: payload.position}, {commitment: root}, {upsert: true});
                            break;
                        }
                    }
                }

                reply_msg(res, 'feedback', startTime);

            } catch (error) {
                return reply_err(res, INTERNAL_ERROR_API, startTime);
            }
        });
    },    

    commitment_commitment: async (req, res) => {
        const startTime = start_time();
        var commitment = get_commitment_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            var addition = commitment;
            var merkleProofData = await models.merkleProof.find({addition: addition});
            if (merkleProofData.length === 0) {

                //if no slot commitment, search added commitments
                const slotCommitment = await models.commitmentAdd.find({
                    addition: addition
                });

                //if added commitment 
                if (slotCommitment.length > 0) {
                    if (slotCommitment[0].confirmed) {
                        commitment = slotCommitment[0].commitment;
                    } else {
                        return reply_err(res, 'Not found', startTime);
                    }
                } else {
                    return reply_err(res, 'Not found', startTime);
                }

                merkleProofData = await models.merkleProof.find({commitment: commitment});

                const response = merkleProofData[0]; // get earliest
                const attestationData = await models.attestation.find({merkle_root: response.merkle_root});

                if (attestationData.length === 0) {
                    return reply_err(res, 'Not found', startTime);
                }

                let index = attestationData.findIndex((item) => item.confirmed === true);
                if (index === -1) {
                    index = attestationData.length - 1;
                }
                ;

                //construct Merkle tree for additions
                const additionList = await models.commitmentAdd.find({client_position: payload.position}, {commitment: commitment}).sort({inserted_at: 1}).exec();

                leaves = [];
                for (var i = 0; i < additionList.length; i++) {
                    var leaf = CryptoJS.enc.Hex.parse(additionList[i].addition);
                    leaves.push(leaf)
                }
                const tree = new MerkleTree(leaves, SHA256);
                const root = tree.getRoot().toString('hex');

                //verify root
                if (root !== commitment) {
                    return reply_err(res, INTERNAL_ERROR_API, startTime);
                }

                //get path for addition
                const binpath = tree.getProof(addition);
                const hexpath = tree.getHexProof(addition);

                var addops = [];

                for(var i = 0; i < binpath.length; i++) {
                    var op = {};
                    if(binpath[i].position == 'right') {
                        op.append = true;
                    } else {
                        op.append = false;
                    }
                    op.commitment = hexpath[i].substring(2);
                }

                reply_msg(res, {
                    attestation: {
                        merkle_root: attestationData[index].merkle_root,
                        txid: attestationData[index].txid,
                        confirmed: attestationData[index].confirmed,
                        inserted_at: moment.utc(attestationData[index].inserted_at).format(DATE_FORMAT)
                    },
                    merkleproof: {
                        position: response.client_position,
                        merkle_root: response.merkle_root,
                        commitment: response.commitment,
                        ops: response.ops
                    },
                    addproof: {
                        addition: addition,
                        ops: addops
                    }
                }, startTime);
            }
            const response = merkleProofData[0]; // get earliest
            const attestationData = await models.attestation.find({merkle_root: response.merkle_root});

            if (attestationData.length === 0) {
                return reply_err(res, 'Not found', startTime);
            }

            let index = attestationData.findIndex((item) => item.confirmed === true);
            if (index === -1) {
                index = attestationData.length - 1;
            }
            ;

            reply_msg(res, {
                attestation: {
                    merkle_root: attestationData[index].merkle_root,
                    txid: attestationData[index].txid,
                    confirmed: attestationData[index].confirmed,
                    inserted_at: moment.utc(attestationData[index].inserted_at).format(DATE_FORMAT)
                },
                merkleproof: {
                    position: response.client_position,
                    merkle_root: response.merkle_root,
                    commitment: response.commitment,
                    ops: response.ops
                }
            }, startTime);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }

    },

    merkleroot: async (req, res) => {
        const startTime = start_time();
        let merkle_root = get_merkle_root_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }
        try {
            const merkleCommitmentData = await models.merkleCommitment.find({merkle_root: merkle_root});
            if (merkleCommitmentData.length === 0) {
                return reply_err(res, 'Commitments not found for merkle_root provided', startTime);
            }

            const array = merkleCommitmentData.map(item => {
                return {
                    position: item.client_position,
                    commitment: item.commitment
                };
            });

            const response = merkleCommitmentData[0];

            const attestationData = await models.attestation.find({merkle_root: response.merkle_root});
            if (attestationData.length === 0) {
                return reply_err(res, 'No attestation found for merkle_root provided', startTime);
            }
            let index = attestationData.findIndex((item) => item.confirmed === true);
            if (index === -1) {
                index = attestationData.length - 1;
            }
            ;

            reply_msg(res, {
                attestation: {
                    merkle_root: attestationData[index].merkle_root,
                    txid: attestationData[index].txid,
                    confirmed: attestationData[index].confirmed,
                    inserted_at: moment.utc(attestationData[index].inserted_at).format(DATE_FORMAT)
                },
                merkle_commitment: array
            }, startTime);

        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    position: async (req, res) => {
        const startTime = start_time();
        const position = get_position_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        const response = {
            'position': position,
            'data': []
        };

        const page = parseInt(req.query.page);
        const limit = 10;
        let start = limit * (page - 1);

        if (!page) {
            start = 0;
        }

        try {
            const makeProofCount = await models.merkleProof.countDocuments({client_position: position});
            response['total'] = makeProofCount;
            response['pages'] = makeProofCount / limit;
            response['limit'] = limit;

            const data = await models.merkleProof
                .find({client_position: position})
                .sort({_id: -1})
                .limit(limit)
                .skip(start)
                .exec();

            if (data.length === 0) {
                return reply_err(res, 'No data found for position provided', startTime);
            }

            for (let itr = 0; itr < data.length; ++itr) {
                const attestationData = await models.attestation.find({merkle_root: data[itr].merkle_root});
                if (attestationData.length === 0) {
                    response['data'].push({
                        commitment: data[itr].commitment,
                        date: ''
                    });
                } else {
                    let index = attestationData.findIndex((item) => item.confirmed === true);
                    if (index === -1) {
                        index = attestationData.length - 1;
                    }
                    ;

                    response['data'].push({
                        commitment: data[itr].commitment,
                        merkle_root: data[itr].merkle_root,
                        txid: attestationData[index].txid,
                        confirmed: attestationData[index].confirmed,
                        ops: data[itr].ops,
                        date: moment.utc(attestationData[index].inserted_at).format(DATE_FORMAT)
                    });

                    const additionList = await models.commitmentAdd.find({client_position: position}, {commitment: data[itr].commitment}).sort({inserted_at: 1}).exec();

                    if (additionList.length > 0) {
                        additions = []
                        for (var i = 0; i < additionList.length; i++) {
                            additions.push({
                                addition: additionList[i].addition,
                                date: moment.utc(additionList[i].inserted_at).format(DATE_FORMAT)
                                });
                        }
                        response['data'][-1].additions = additions;   
                    }

                }
            }

            const client = await models.clientDetails.findOne({client_position: position});
            if (!client) {
                return reply_err(res, 'No client details found for position provided', startTime);
            }
            response['client_name'] = client.client_name;
            res.json(response);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    attestation: async (req, res) => {
        const startTime = start_time();
        const hash = get_txid_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const attestationData = await models.attestation.find({txid: hash});
            if (attestationData.length === 0) {
                return reply_err(res, 'No attestation found', startTime);
            }
            const response = attestationData[0];
            const data = await models.attestationInfo.find({txid: hash});

            if (data.length === 0) {
                reply_msg(res, {
                    attestation: {
                        merkle_root: response.merkle_root,
                        txid: response.txid,
                        confirmed: response.confirmed,
                        inserted_at: moment.utc(response.inserted_at).format(DATE_FORMAT)
                    },
                    attestationInfo: {
                        txid: response.txid,
                        amount: '',
                        blockhash: '',
                        time: ''
                    }
                }, startTime);
            } else {
                reply_msg(res, {
                    attestation: {
                        merkle_root: response.merkle_root,
                        txid: response.txid,
                        confirmed: response.confirmed,
                        inserted_at: moment.utc(response.inserted_at).format(DATE_FORMAT)
                    },
                    attestationInfo: {
                        txid: data[0].txid,
                        amount: data[0].amount / 100000000,
                        blockhash: data[0].blockhash,
                        time: data[0].time
                    }
                }, startTime);
            }
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    blockhash: async (req, res) => {
        const startTime = start_time();
        const hash = get_hash_arg(req, res, startTime);
        if (res.headersSent) {
            return;
        }

        try {
            const data = await models.attestationInfo.find({blockhash: hash});
            if (data.length === 0) {
                return reply_err(res, 'No attestations found for blockhash provided', startTime);
            }
            reply_msg(res, {
                blockhash: {
                    txid: data[0].txid,
                    amount: data[0].amount / 100000000,
                    blockhash: data[0].blockhash,
                    time: moment.utc(data[0].time * 1000).format(DATE_FORMAT)
                }
            }, startTime);
        } catch (error) {
            return reply_err(res, INTERNAL_ERROR_API, startTime);
        }
    },

    clients: async (req, res) => {

        const response = [];
        try {
            const attestationData = await models.attestation.find({confirmed: true}).sort({inserted_at: -1}).limit(1).exec();
            if (attestationData.length === 0) {
                return res.json(response);
            }

            const merkle_root = attestationData[0].merkle_root;
            const data = await models.clientDetails.find().exec();

            for (let itr = 0; itr < data.length; ++itr) {
                const client = await models.merkleCommitment.findOne({
                    client_position: data[itr].client_position,
                    merkle_root: merkle_root
                }).exec();

                if (client) {
                    response.push({
                        position: data[itr].client_position,
                        client_name: data[itr].client_name,
                        commitment: client.commitment
                    });
                } else {
                    response.push({
                        position: data[itr].client_position,
                        client_name: data[itr].client_name
                    });
                }
            }

            res.json(response);

        } catch (error) {
            res.json({
                error: INTERNAL_ERROR_API,
                timestamp: new Date().getTime(),
            });
        }
    },
};
