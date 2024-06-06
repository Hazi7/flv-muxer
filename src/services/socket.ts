import { io, type Socket } from "socket.io-client";

export class socketService {

    private socket: Socket | null = null;
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        this.socket = io(this.url);
        if (this.socket) {
            this.socket.on('connection', this.onConnect.bind(this));
            this.socket.on('onConnectError', this.onConnectError.bind(this));
            this.socket.on('onDisconnect', this.onDisconnect.bind(this));
        } else {
            throw new Error("Socket is not connected");
        }
    }

    sendMessage(message: string) {
        if (this.socket) {
            this.socket.emit('message', message);
        } else {
            throw new Error("Socket is not connected");
        }
    }

    onMessage(event: string, callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    onConnect() {
        
    }

    onConnectError() {

    }

    onDisconnect() {

    }


}