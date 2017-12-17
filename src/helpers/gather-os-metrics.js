const pidusage = require('pidusage');  // Need to remove this and use si infor
const si = require('systeminformation');
const lag = require('event-loop-lag')(1000);
const os = require('os');
const sendMetrics = require('./send-metrics');

function getSizeBy1(obj) {
  return (parseInt(obj, 10) / 1024);
}

function getSizeBy2(obj) {
  return (parseInt(obj, 10) / 1024 / 1024);
}

function getProcessData(obj) {
  return {
    pid: obj.pid,
    name: obj.name,
    pcpu: obj.pcpu,
    mem_rss: obj.mem_rss,
    memory: getSizeBy1(obj.mem_rss),
    state: obj.state,
  };
}

function sortByMemRSS(a, b) {
  if (a.mem_rss > b.mem_rss) {
    return -1;
  }
  if (a.mem_rss < b.mem_rss) {
    return 1;
  }
  return 0;
}

async function info() {
  const out = {
    osMemory: {},
    osLoad: {},
    eventLoop: {
      'lag': lag(),
    },
  };

  try {
    const statsObj = await pidData();
    const memoryData = await si.mem();
    out.osLoad = await si.currentLoad();

    for (const prop in memoryData) {
      out.osMemory[prop] = getSizeBy2(memoryData[prop]);
    };

    return Object.assign(statsObj, out);
  } catch (e) {
    throw e;
  }
}

function pidData() {

  return new Promise((resolve, reject) => {
    pidusage.stat(process.pid, (err, stat) => {
      if (err) {
        reject(err);
      }

      const statObj = stat;
      statObj.memory = statObj.memory / 1024 / 1024; // Convert from B to MB
      statObj.load = os.loadavg();
      statObj.timestamp = Date.now();

      resolve(statObj);
    });
  });
}


module.exports = (io, span) => {

  const defaultResponse = {
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    count: 0,
    mean: 0,
    timestamp: Date.now(),
  };

  info()
    .then((statObj) => {

      //const statObj = {};

      /*
      `cpu` cpu percent
       `memory` memory bytes
       `time` user + system time
       `start` time process was started
      */

      //statObj.memory = statObj.memory / 1024 / 1024; // Convert from B to MB
      //statObj.load = os.loadavg();
      //statObj.timestamp = Date.now();
      span.os.push(statObj);

      const last = span.responses[span.responses.length - 1];
      if (!span.responses[0] || last.timestamp + (span.interval * 1000) < Date.now()) {
        span.responses.push(defaultResponse);
      }

      // todo: I think this check should be moved somewhere else
      if (span.os.length >= span.retention) span.os.shift();
      if (span.responses[0] && span.responses.length > span.retention) span.responses.shift();

      sendMetrics(io, span);

    })
    .catch((err) => {
      console.error(err); // eslint-disable-line no-console
      return;
    })

  /*
pidusage.stat(process.pid, (err, stat) => {
  if (err) {
    console.error(err); // eslint-disable-line no-console
    return;
  }

  const statObj = stat;
  statObj.memory = statObj.memory / 1024 / 1024; // Convert from B to MB
  statObj.load = os.loadavg();
  statObj.timestamp = Date.now();
  span.os.push(statObj);

  const last = span.responses[span.responses.length - 1];
  if (!span.responses[0] || last.timestamp + (span.interval * 1000) < Date.now()) {
    span.responses.push(defaultResponse);
  }

  // todo: I think this check should be moved somewhere else
  if (span.os.length >= span.retention) span.os.shift();
  if (span.responses[0] && span.responses.length > span.retention) span.responses.shift();

  sendMetrics(io, span);
});
*/

};



