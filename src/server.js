const http = require("http");
const path = require("path");
const { readFileSync } = require("fs");
const bencode = require("bencode").encode;

const Tracker = require("./tracker");

module.exports = class Server {
    constructor() {
        this.indexHTML = readFileSync(path.join(__dirname, "../app/index.html"))?.toString();

        this.tracker = new Tracker();
        this.server = http.createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "text/plain" });

            if (!req.url.startsWith("/announce?")) {
                if (req.url == "/" && this.indexHTML) {
                    let html = this.indexHTML;
                    let stats = `<p><b>Torrent count:</b> ${this.tracker.torrentList.size}</p>`;
                    stats    += `<p><b>Peer count:</b> ${this.tracker.getTotalPeerCount()}</p>`;

                    html = html.replace("{{stats}}", stats);

                    res.writeHead(200);
                    res.end(html);
                    
                    return;
                }

                res.writeHead(404);
                res.end();

                return;
            } else {
                let params = this._parseUrlParams(req.url.slice(10));
                if (!params.ip) params.ip = req.socket.remoteAddress.match(/\d+\.\d+\.\d+\.\d+/g)?.[0];
                if (params.port < 1 || params.port > 0xFFFF)
                    this._sendErrorResponse(res, "invalid port");

                try {
                    let response = this.tracker.announce(params);
                    res.end(bencode(response));
                } catch(e) {
                    console.error(e);

                    this._sendErrorResponse(res, e.message);
                }
            }
        });
    }

    start(port) {
        this.server.listen(port, () => console.log(`Server running on port ${port}.`));
    }

    _sendErrorResponse(res, message) {
        res.end(bencode({ "failure reason": message }));
    }

    _parseUrlParams(url) {
        let parsed = {};
    
        url.split("&").forEach(v => {
            if (!v) return;

            v = v.split("=");
            if (v[1].includes("%")) {
                v[1] = v[1].toLowerCase();
            }
    
            if (v[0] == "port" || v[0] == "uploaded" || v[0] == "downloaded" || v[0] == "left") {
                v[1] = parseInt(v[1]);
            }
    
            parsed[v[0]] = v[1];
        });
    
        return parsed;
    }
}