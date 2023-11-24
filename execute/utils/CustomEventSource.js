import('node-fetch')
  .then(({ default: fetch }) => {
    // Your code that uses 'fetch' here

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

      simulateBundleEvents() {
        // Simulate bundle events with transactions
        const bundleData = {
          events: [
            // Event 1
            {
              "address": "0xd1ebb648ef482a6405f176bb03897e5502c75c4c",
              "topics": [
                "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1"
              ],
              "data": "0x0000000000000000000000000000000000000000000000000e73f6f48500c6fc00000000000000000000000000000000000000000000000000aa9631539fa2f2"
            },
            // Event 2
            {
              "address": "0xd1ebb648ef482a6405f176bb03897e5502c75c4c",
              "topics": [
                "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
                "0x0000000000000000000000004648a43b2c14da09fdf82b161150d3f634f40491",
                "0x00000000000000000000000075d2e010392c99e1dab54781bfe4760a091a2c51"
              ],
              "data": "0x00000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000042e58d01e3b"
            }
          ],
          txs: null
        };

        this.dispatchEvent({ event: 'bundleEvent', data: bundleData });
      }
    }

    // Handler for the new 'bundleEvent'
    function handleBundleEvent(data) {
      console.log('Received Bundle Event:', JSON.stringify(data, null, 2));

      // Process bundle transactions
      if (data && data.data && data.data.txs) {
        data.data.txs.forEach((transaction) => {
          handleEvent({ data: transaction }); // Reuse the existing event handler for individual transactions
        });
      }
    }

    // Handler for individual transactions
    function handleEvent(data) {
      if (data.address && data.topics && data.data) {
        console.log(JSON.stringify({
          address: data.address,
          topics: data.topics,
          data: data.data,
        }, null, 2));
      }
    }

    // Example usage with Flashbots MEV-Share event stream
    const goerliEventStreamUrl = 'https://mev-share-goerli.flashbots.net';
    const eventSource = new CustomEventSource(goerliEventStreamUrl);

    // Subscribe to relevant events
    eventSource.addEventListener('firstPairEvent', handleEvent);
    eventSource.addEventListener('secondPairEvent', handleEvent);
    eventSource.addEventListener('transactionHashEvent', handleEvent);
    eventSource.addEventListener('bundleEvent', handleBundleEvent); // New event type

    // Simulate events triggering
    try {
      eventSource.simulateBundleEvents();
    } catch (error) {
      console.error('Error simulating bundle events:', error);
    }
  })
  .catch((error) => {
    console.error('Error importing node-fetch:', error);
  });
