module.exports = class Tracker {
    constructor(inactivityDelay = 60 * 1000) {
        this.torrentList = new Map();

        // Clear inactive peers
        setInterval(() => {
            this.torrentList.forEach((torrent, infoHash) => {
                if (torrent.peers.length < 1) {
                    this.torrentList.remove(infoHash);
                }

                torrent.peers.forEach((peer, key) => {
                    if ((peer.lastActivity + inactivityDelay) <= Date.now()) {
                        torrent.peers.splice(key);
                    }
                });
            });
        }, inactivityDelay);
    }

    announce(params) {
        let missingParam = this._isMissingParams(params);
        if (missingParam) throw new Error(`bro, where is ${missingParam}`);

        let infoHash = params.info_hash;

        let peer = {
            peer_id: params.peer_id,
            ip: params.ip,
            port: params.port,
            left: params.left
        };

        if (!this.torrentList.has(infoHash)) {
            this.torrentList.set(infoHash, {
                peers: []
            });
        }

        if (!params.event || params.event != "stopped") {
            this.insertPeer(infoHash, peer);
        } else {
            this.removePeer(infoHash, peer);
        }

        return this._response(params);
    }

    insertPeer(infoHash, peer) {
        const torrent = this.torrentList.get(infoHash);
        peer.lastActivity = Date.now();

        const exists = torrent.peers.findIndex(v => v.peer_id == peer.peer_id || v.ip == peer.ip && v.port == peer.port);
        if (exists != -1) {
            torrent.peers[exists] = peer;
        } else {
            torrent.peers.push(peer);
        }

        this.torrentList.set(infoHash, torrent);
    }

    removePeer(infoHash, peer) {
        const torrent = this.torrentList.get(infoHash);
        const exists = torrent.peers.findIndex(v => v.ip == peer.ip && v.port == peer.port);
        if (!exists) return;

        torrent.peers.splice(exists);
    }

    getTotalPeerCount() {
        let count = 0;

        this.torrentList.forEach(v => count += v.peers.length);

        return count;
    }

    _isMissingParams(params) {
        const requiredParams = ["info_hash", "peer_id", "port"];
    
        for (let key of requiredParams) {
            if (!params[key]) {
                return key;
            }
        }
    }

    _response(params) {
        const torrent = this.torrentList.get(params.info_hash);
        const response = {
            interval: 600,
            complete: torrent.complete = 0,
            incomplete: torrent.incomplete = 0,
            peers: []
        };

        let count = 0;
        
        if (params.compact == 1) {
            let peers = Buffer.alloc(0);
    
            torrent.peers.forEach(peer => {
                peer.left == 0 ? response.complete++ : response.incomplete++;

                if (count >= params.numwant || count >= 250) return;
                count++;

                let ipBytes = peer.ip.split(".");
                let buf = Buffer.alloc(6);
                buf[0] = parseInt(ipBytes[0]);
                buf[1] = parseInt(ipBytes[1]);
                buf[2] = parseInt(ipBytes[2]);
                buf[3] = parseInt(ipBytes[3]);
                buf.writeUInt16BE(params.port, 4);
    
                peers = Buffer.concat([ peers, buf ]);
            });
    
            response.peers = peers;

            return response;
        } else {
            torrent.peers.forEach(peer => {
                peer.left == 0 ? response.complete++ : response.incomplete++;

                if (count >= params.numwant || count >= 250) return;
                count++;

                response.peers.push({
                    id: params.no_peer_id == 1 ? null : peer.peer_id,
                    ip: peer.ip,
                    port: peer.port
                });
            });

            return response;
        }
    }
}