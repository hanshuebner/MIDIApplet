
function decodeHexString(string) {
    var data = [];
    for (var i = 0; i < string.length; i += 2) {
        data.push(parseInt(string.substr(i, 2), 16));
    }
    return data;
}

function decodeHexFile(data) {
    var retval = [];
    var nextAddress = 0;
    
    function decodeRecord(fullMatch, length, address, data, checksum) {
        length = parseInt(length, 16);
        address = parseInt(address, 16);
        checksum = parseInt(checksum, 16); /* fixme: checksum not validated */
        data = decodeHexString(data);
        if (length != data.length) {
            addToLog('data length mismatch in hex file, expected ' + length + ' got ' + data.length);
            throw "invalid hex file";
        }
        if (address != nextAddress) {
            addToLog('invalid address in hex file, expected ' + nextAddress + ' got ' + address);
            throw "invalid hex file";
        }
        nextAddress += length;
        retval.push.apply(retval, data);
    }

    map(function(line) {
            var match = line.match(/^:(..)(....)00(.*)(..)$/);
            if (match) {
                decodeRecord.apply(this, match);
            }
        }, data.split(/\r?\n/));

    addToLog('read hex file, length: ' + retval.length);

    return retval;
}

var blockSize = 64;

function makeBootDataBlockMessage(data, offset) {
    var length = Math.min(blockSize, data.length - offset);

    var checksum = 0x01
        ^ length
        ^ ((offset >> 21) & 0x7f)
        ^ ((offset >> 14) & 0x7f)
        ^ ((offset >> 7) & 0x7f)
        ^ (offset & 0x7f);

    function encodeBinary(data) {
        var encoded = [];
        for (var i = 0; i < data.length; i += 7) {
            var highBitPos = encoded.length;
            encoded.push(0);
            var mask = 1;
            map(function (byte) {
                    if (byte & 0x80) {
                        encoded[highBitPos] |= mask;
                    }
                    mask <<= 1;
                    encoded.push(byte & 0x7f);
                }, data.slice(i, i + 7));
        }
        map(function (byte) { checksum ^= byte; }, encoded);
        return ''.concat.apply('', map(encode7Bits, encoded));
    }

    return 'f0 00 13 41 01 '
        + encode7Bits(length) + ' '
        + encode21Bits(offset) + ' '
        + encodeBinary(data.slice(offset, offset + length)) + ' '
        + encode7Bits(checksum) + ' '
        + 'f7';
}

function uploadFirmware(hexData) {
    var firmware = decodeHexFile(hexData);
    // Pad firmware to 256 byte boundary to match flash page size
    if (firmware.length % 256) {
        firmware.push.apply(firmware, list(repeat(0xff, 256 - (firmware.length % 256))));
    }

    document.firmware = [];
    for (var i = 0; i < firmware.length; i += 64) {
        document.firmware.push(makeBootDataBlockMessage(firmware, i));
    }

    var checksum = 0;
    map(function (byte) { checksum += byte; }, firmware);

    document.firmware.push('f0 00 13 41 03 '
                           + encode21Bits(firmware.length)
                           + ' ' + encode14Bits(checksum & 0x3fff)
                           + ' f7');
    document.firmware.push('f0 00 13 41 04 f7');

    // Start boot loader.  It will send an ack which will in turn trigger the transfer.
    applet.send('f0 00 13 41 05 f7');
}

function getHexFile() {
    $.get('mididata.hex', uploadFirmware);
}

function midiMessageReceived(message) {
    matchMidiMessage(message,
                     /^b. (..) (..)/, function (byte1, byte2) {
                         if (byte1 == "63") {
                             parameterNumber = parseInt(byte2, 16) << 7;
                             parameterValue = 0;
                         } else if (byte1 == "62") {
                             parameterNumber |= parseInt(byte2, 16);
                         } else if (byte1 == "06") {
                             parameterValue = parseInt(byte2, 16) << 7;
                         } else if (byte1 == "26") {
                             parameterValue |= parseInt(byte2, 16);
                             addToLog("NRPN " + parameterNumber + " => " + parameterValue);
                         } else {
                             addToLog(message);
                         }
                     },

                     /^f0 00 13 41 02/, function () {
                         if (document.firmware.length) {
                             applet.send(document.firmware.shift());
                         }
                     },

                     /^f0 00 13 41 10/, function () {
                         document.firmware = [];
                         addToLog('NAK received from boot loader, upload aborted');
                     },

                     /(.*)/, function (message) {
                         addToLog("unmatched: " + message);
                     });
}

$(document).ready(function () {
    applet = document.applets[0];

    document.firmware = [];

    initMidiPortSelectors('inputSelect', 'outputSelect', applet, 'midiMessageReceived');
    
    restoreStateFromCookie();
});
