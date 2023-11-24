// Import necessary modules
const axios = require('axios');

class CustomEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.connect();
  }

  connect() {
    this.source = new EventSource(this.url);

    this.source.onopen = () => {
      console.log('Connection established');
    };

    this.source.onerror = (error) => {
      console.error('Error:', error);
      this.reconnect();
    };

    this.source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.dispatchEvent(data);
    };
  }

  addEventListener(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  dispatchEvent(data) {
    const eventName = data.event; // Assuming the event type is included in the data

    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((callback) => {
        callback(data);
      });
    }
  }

  reconnect() {
    console.log('Reconnecting...');
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  close() {
    if (this.source) {
      this.source.close();
      console.log('Connection closed');
    }
  }
}

module.exports = CustomEventSource;
