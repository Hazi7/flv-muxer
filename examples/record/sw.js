self.onmessage = (event) => {
  if (event.data.type === "START_RECORDING") {
    console.log(event.ports[0]);
  } else if (event.data.type === "STOP_RECORDING") {
    console.log("Recording stopped in worker");
  }
};


