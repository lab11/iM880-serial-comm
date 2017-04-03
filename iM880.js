#!/usr/bin / env mode
/*
 *
 * configure iM880B
 */

// Lora Constants
const DEVMGMT_ID = 0x01;
const DEVMGMT_MSG_PING_REQ = 0x01;
const DEVMGMT_MSG_PING_RSP = 0x02;
const DEVMGMT_MSG_GET_DEVICE_INFO_REQ = 0x03;
const DEVMGMT_MSG_GET_DEVICE_INFO_RSP = 0x04;
const DEVMGMT_MSG_GET_FW_INFO_REQ = 0x05;
const DEVMGMT_MSG_GET_FW_INFO_RSP = 0x06;
const DEVMGMT_MSG_RESET_REQ = 0x07;
const DEVMGMT_MSG_RESET_RSP = 0x08;
const DEVMGMT_MSG_SET_OPMODE_REQ = 0x09;
const DEVMGMT_MSG_SET_OPMODE_RSP = 0x0A;
const DEVMGMT_MSG_GET_OPMODE_REQ = 0x0B;
const DEVMGMT_MSG_GET_OPMODE_RSP = 0x0C;
const DEVMGMT_MSG_SET_RTC_REQ = 0x0D;
const DEVMGMT_MSG_SET_RTC_RSP = 0x0E;
const DEVMGMT_MSG_GET_RTC_REQ = 0x0F;
const DEVMGMT_MSG_GET_RTC_RSP = 0x10;
const DEVMGMT_MSG_SET_RADIO_CONFIG_REQ = 0x11;
const DEVMGMT_MSG_SET_RADIO_CONFIG_RSP = 0x12;
const DEVMGMT_MSG_GET_RADIO_CONFIG_REQ = 0x13;
const DEVMGMT_MSG_GET_RADIO_CONFIG_RSP = 0x14;
const DEVMGMT_MSG_RESET_RADIO_CONFIG_REQ = 0x15;
const DEVMGMT_MSG_RESET_RADIO_CONFIG_RSP = 0x16;
const DEVMGMT_MSG_GET_SYSTEM_STATUS_REQ = 0x17;
const DEVMGMT_MSG_GET_SYSTEM_STATUS_RSP = 0x18;
const DEVMGMT_MSG_SET_RADIO_MODE_REQ = 0x19;
const DEVMGMT_MSG_SET_RADIO_MORE_RSP = 0x1A;
const DEVMGMT_STATUS_OK = 0x00;                // Operation successful;
const DEVMGMT_STATUS_ERROR = 0x01;             // Operation failed;
const DEVMGMT_STATUS_CMD_NOT_SUPPORTED = 0x02; // Command is not supported;
const DEVMGMT_STATUS_WRONG_PARAMETER = 0x03;
// CRC constants
const CRC16_INIT_VALUE = 0xFFFF;
const CRC16_GOOD_VALUE = 0x0F47;
const CRC16_POLYNOM = 0x8408;
// RadioLink constants
const RADIOLINK_MSG_SEND_U_DATA_REQ = 0x01;
const RADIOLINK_MSG_SEND_U_DATA_RSP = 0x02;
const RADIOLINK_MSG_U_DATA_RX_IND = 0x04;
const RADIOLINK_MSG_U_DATA_TX_IND = 0x06;
const RADIOLINK_MSG_SEND_C_DATA_REQ = 0x09;
const RADIOLINK_MSG_SEND_C_DATA_RSP = 0x0A;
const RADIOLINK_MSG_C_DATA_RX_IND = 0x0C;
const RADIOLINK_MSG_C_DATA_TX_IND = 0x0E;
const RADIOLINK_MSG_ACK_RX_IND = 0x10;
const RADIOLINK_MSG_ACK_TIMEOUT_IND = 0x12;
const RADIOLINK_MSG_ACK_TX_IND = 0x14;
const RADIOLINK_ID = 0x03;

// SET STATES HERE
const INIT = 0x00;
const WAIT_INIT_ACK = 0x01;
const WAIT_CONFIG_ACK = 0x02;
const WAIT_CMD = 0x03;
const WAIT_TRANSMIT = 0x04;
const WAIT_RX_ACK = 0x05;
const WAIT_TRANSMIT_UNCONFIRMED = 0x06;

// require events and slip and serial port
var slip = require('slip');
var SerialPort = require('serialport');
var events = require('events');
var util = require('util');

var iM880 = function(serport, deviceID, deviceGroup, sf, bandwidth, error_coding, tx_pwr) {

  // default parameters
  if (sf === null) {
    sf = 10;
  }
  if(tx_pwr === null) {
    tx_pwr = 20;
  }

  // convert bandwidth to number configuration wants
  bandwidth_num = 0;
  if(bandwidth == 500000) {
    bandwidth_num = 2;
  } else if (bandwidth == 250000) {
    bandwidth_num = 1;
  } else {
    // 125000 bandwidth
    bandwidth_num = 0;
  }

  // convert error coding to number configuration wants
  error_coding_num = 0;
  if (error_coding == 4/8){
    error_coding_num = 4;
  } else if (error_coding == 4/7) {
    error_coding_num = 3;
  } else if (error_coding == 4/6) {
    error_coding_num = 2;
  } else {
    // 4/5 error coding
    error_coding_num = 0;
  }

  this.port = new SerialPort(
      serport, {baudrate : 115200, parser : SerialPort.parsers.raw});
  this.decoder = new slip.Decoder({});
  this.currState = INIT;
  
  var that = this;
  this.port.on('open', function() {
    // make ping packet
    var packet = that.makePacket(DEVMGMT_ID, DEVMGMT_MSG_PING_REQ, '');
    that.port.write(packet);
    that.currState = WAIT_INIT_ACK;
  });
  this.port.on('data', function(data) {
    data = that.decoder.decode(data);

    // check for received messages always
    if (data) {
      // confirmed data reception
      var now = new Date().toISOString();
      var rxmsgdata = {};
      if ((data[1] == RADIOLINK_MSG_C_DATA_RX_IND) &&
          that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
        // if data[0], 0th bit ==0 then non extended form
        if (!(data[2] & 1)) {
            rxmsgdata = {
                destGroupAddr   : data[3],
                destDeviceAddr  : ((data[4] << 8) + data[5]),
                srcGroupAddr    : data[6],
                srcDeviceAddr   : ((data[7] << 8) + data[8]),
                payload           : data.slice(9, data.length-2),
                receivedTime      : now
            };
        } else {
          // extended mode with more information, return entire msg instead
            rxmsgdata = {
                destGroupAddr   : data[3],
                destDeviceAddr  : ((data[4] << 8) + data[5]),
                srcGroupAddr    : data[6],
                srcDeviceAddr   : ((data[7] << 8) + data[8]),
                payload         : data.slice(9, data.length-9),
                rssi            : ((data[data.length-9] << 8) + data[data.length-8]),
                snr             : data[data.length-7],
                receivedTime    : now
            };
        }
        that.emit('rx-msg', rxmsgdata);
      }
      // unconfirmed data reception
      else if ((data[1] == RADIOLINK_MSG_U_DATA_RX_IND) &&
          that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
        // if data[0], 0th bit ==0 then non extended form
        if (!(data[2] & 1)) {
            rxmsgdata = {
                destGroupAddr   : data[3],
                destDeviceAddr  : ((data[4] << 8) + data[5]),
                srcGroupAddr    : data[6],
                srcDeviceAddr   : ((data[7] << 8) + data[8]),
                payload           : data.slice(9, data.length-2),
                receivedTime      : now
            };
        } else {
          // extended mode with more information, return entire msg instead
            rxmsgdata = {
                destGroupAddr   : data[3],
                destDeviceAddr  : ((data[4] << 8) + data[5]),
                srcGroupAddr    : data[6],
                srcDeviceAddr   : ((data[7] << 8) + data[8]),
                payload         : data.slice(9, data.length-9),
                rssi            : ((data[data.length-9] << 8) + data[data.length-8]),
                snr             : data[data.length-7],
                receivedTime    : now
            };
        }
        that.emit('rx-msg', rxmsgdata);
      }
    }

    // state machine to control configuration and transmission
    switch (that.currState) {
    case WAIT_INIT_ACK:
      if (data) {
        if ((data[1] == DEVMGMT_MSG_PING_RSP) &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          // console.log('iM880B pinged!');
          var config_msg = new Uint8Array([
            0x01, 0x0, deviceGroup, 0x10, (deviceID & 0xFF00), 
            (deviceID & 0xFF), 0, 0x03, 0, 0xD5, 0xC8, 0xE4, bandwidth_num, sf, error_coding_num,
            tx_pwr, 0, 0x01, 0x03, 0xE8, 0x0F, 0x0F, 0, 0, 0, 0 ]);
          var packet = that.makePacket(
              DEVMGMT_ID, DEVMGMT_MSG_SET_RADIO_CONFIG_REQ, config_msg);
          that.port.write(packet);
          that.currState = WAIT_CONFIG_ACK;
        }
      }
      break;
    case WAIT_CONFIG_ACK:
      if (data) {
        if ((data[1] == DEVMGMT_MSG_SET_RADIO_CONFIG_RSP) &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_CMD;
          var msg = that.interpretStatusByte('config', data[2]);
          that.emit('config-done', msg);
        }
      }
      break;
    case WAIT_CMD:
      if (data) {
        if (data[1] == RADIOLINK_MSG_SEND_C_DATA_RSP &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_TRANSMIT;
        } else if (data[1] == RADIOLINK_MSG_SEND_U_DATA_RSP &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_TRANSMIT_UNCONFIRMED;
        }
      }
      break;
    case WAIT_TRANSMIT:
      if (data) {
        if (data[1] == RADIOLINK_MSG_C_DATA_TX_IND &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_RX_ACK;
          txdata = that.interpretStatusByte('radio', data[2]);
        }
      }
      break;
    case WAIT_TRANSMIT_UNCONFIRMED:
      if (data) {
        if (data[1] == RADIOLINK_MSG_U_DATA_TX_IND &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_CMD;
          txdata = that.interpretStatusByte('radio', data[2]);
          that.emit('tx-msg-done', txdata);
        }
      }
      break;
    case WAIT_RX_ACK:
      if (data) {
        if (data[1] == RADIOLINK_MSG_ACK_RX_IND &&
            that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_CMD;
          that.emit('tx-msg-done', txdata);
        } else if (data[1] == RADIOLINK_MSG_ACK_TIMEOUT_IND &&
                   that.CRC16_Check(data, 0, data.length, CRC16_INIT_VALUE)) {
          that.currState = WAIT_CMD;
          txdata = 'ACK timeout, transmission still sent';
          that.emit('tx-msg-done', txdata);
        }
      }
      break;
    default:
      that.currState = INIT;
    
      }
      });
};

util.inherits(iM880, events.EventEmitter);

// send method
iM880.prototype.sendConfirmed = function(destDevice, destGroup, msg) {
  // make the packet and add destination addresses to msg
  const newmsg = new Uint8Array(msg.length + 3);
  newmsg[0] = destGroup;
  newmsg[1] = (destDevice & 0xFF00);
  newmsg[2] = (destDevice & 0xFF);

  for (var i = 0; i < msg.length; i++) {
    newmsg[3 + i] = msg[i];
  }
  var packet =
      this.makePacket(RADIOLINK_ID, RADIOLINK_MSG_SEND_C_DATA_REQ, newmsg);
  // send the packet
  this.port.write(packet);
  this.currState = WAIT_CMD;
};

iM880.prototype.configure = function(deviceID, deviceGroup, sf, bandwidth, error_coding, tx_pwr) {

  // default parameters
  if (sf === null) {
    sf = 10;
  }
  if (tx_pwr === null) {
    tx_pwr = 20;
  }

  // convert bandwidth to number configuration wants
  bandwidth_num = 0;
  if (bandwidth == 500000) {
    bandwidth_num = 2;
  } else if (bandwidth == 250000) {
    bandwidth_num = 1;
  } else {
    // 125000 bandwidth
    bandwidth_num = 0;
  }

  // convert error coding to number configuration wants
  error_coding_num = 0;
  if (error_coding == 4/8){
    error_coding_num = 4;
  } else if (error_coding == 4/7) {
    error_coding_num = 3;
  } else if (error_coding == 4/6) {
    error_coding_num = 2;
  } else {
    // 4/5 error coding
    error_coding_num = 0;
  }

  var config_msg = new Uint8Array([
      0x01, 0x0, deviceGroup, 0x10, (deviceID & 0xFF00),
      (deviceID & 0xFF), 0, 0x03, 0, 0xD5, 0xC8, 0xE4, bandwidth_num, sf, error_coding_num,
      tx_pwr, 0, 0x01, 0x03, 0xE8, 0x0F, 0x0F, 0, 0, 0, 0 ]);
  var packet = this.makePacket(
      DEVMGMT_ID, DEVMGMT_MSG_SET_RADIO_CONFIG_REQ, config_msg);
  this.currState = WAIT_CONFIG_ACK;
  this.port.write(packet);
};

iM880.prototype.sendBroadcast = function(msg) {
  // make the packet and add destination addresses to msg
  const newmsg = new Uint8Array(msg.length + 3);
  newmsg[0] = 0xFF;
  newmsg[1] = 0xFF;
  newmsg[2] = 0xFF;

  for (var i = 0; i < msg.length; i++) {
    newmsg[3 + i] = msg[i];
  }
  var packet =
      this.makePacket(RADIOLINK_ID, RADIOLINK_MSG_SEND_U_DATA_REQ, newmsg);
  // send the packet
  this.port.write(packet);
  this.currState = WAIT_CMD;
};

// function to make lora packet and send
iM880.prototype.makePacket = function(endpointID, msgID, message) {
  // declare the packet
  packet = new Uint8Array(message.length + 4);
  packet[0] = endpointID;
  packet[1] = msgID;

  for (var i = 0; i < message.length; i++) {
    packet[2 + i] = message[i];
  }
  var result = this.CRC16_Calc(packet, 0, 2 + message.length, CRC16_INIT_VALUE);
  packet[2 + message.length] = result & 0xFF;
  packet[3 + message.length] = (result >> 8);
  var check = this.CRC16_Check(packet, 0, 4 + message.length, CRC16_INIT_VALUE);
    
  // check that checksum correct before adding final C0
  if (check) {
    packet = slip.encode(packet);
    return packet;
  } else {
    console.log('Checksum check failed! Your message: ' + message +
                'will not be delivered');
    return 0;
  }
};

// interpret status byte
iM880.prototype.interpretStatusByte = function(type, val) {
  var msg = 0;
  if (type == 'config') {
    if (val === 0x00) {
      msg = 'successful!';
    } else if (val == 0x01) {
      msg = 'operation failed';
    } else if (val == 0x02) {
      msg = 'command not supported (check system operation mode)';
    } else if (val == 0x03) {
      msg = 'HCI message contains wrong parameter';
    }
  } else if (type == 'radio') {
    if (val === 0x00) {
      msg = 'successful!';
    } else if (val == 0x01) {
      msg = 'failed';
    } else if (val == 0x02) {
      msg = 'command not supported (check system operation mode)';
    } else if (val == 0x03) {
      msg = 'HCI message contains wrong parameter';
    } else if (val == 0x04) {
      msg = 'module operates in wrong radio mode';
    } else if (val == 0x05) {
      msg = 'transmission not possible due to LBT result "media busy"';
    } else if (val == 0x07) {
      msg = 'no buffer for radio transmission available';
    } else if (val == 0x08) {
      msg = 'radio packet length invalid';
    }
  }
  return msg;
};

// --------------- CRC FUNCTIONS ------------------------------>
// CRC calculation
iM880.prototype.CRC16_Calc = function(data, start, length, initVal) {
  // init crc
  var crc = initVal;
  // iterate over all bytes
  for (var i = 0; i < length; i++) {
    var bits = 8;
    var byte = data[start + i];
    // iterate over all bits per byte
    while (bits--) {
      if ((byte & 1) ^ (crc & 1)) {
        crc = (crc >> 1) ^ CRC16_POLYNOM;
      } else {
        crc >>= 1;
      }
      byte >>= 1;
    }
  }
  return (~crc & 65535);
};

//------------------------------------------------------------------------------

// CRC16_Check
//
//------------------------------------------------------------------------------
//!
//! @brief calculate & test CRC16
//!
//------------------------------------------------------------------------------
//!
//! This function checks a data block with attached CRC16
//!
//! <!------------------------------------------------------------------------->
//! @param[in] data pointer to data block
//! @param[in] length number of bytes (including CRC16)
//! @param[in] initVal CRC16 initial value
//! <!------------------------------------------------------------------------->
//! @retVal true CRC16 ok -> data block ok
//! @retVal false CRC16 failed -> data block corrupt
//------------------------------------------------------------------------------
iM880.prototype.CRC16_Check = function(data, start, length, initVal) {
  // calculate ones complement of CRC16
  var crc = this.CRC16_Calc(data, start, length, initVal);
  if (crc == CRC16_GOOD_VALUE)
    return true;
  return false;
};

module.exports = iM880;
