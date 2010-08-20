
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
        + encode28Bits(offset) + ' '
        + encodeBinary(data.slice(offset, offset + length)) + ' '
        + encode7Bits(checksum) + ' '
        + 'f7';
}

function uploadFirmware(hexData) {
    var firmware = decodeHexFile(hexData);
    if (firmware.length % 256) {
        firmware.push.apply(firmware, list(repeat(0xff, 256 - (firmware.length % 256))));
    }

    for (var i = 0; i < firmware.length; i += 64) {
        log(makeBootDataBlockMessage(firmware, i));
    }

    var checksum = 0;
    map(function (byte) { checksum += byte; }, firmware);

    log('f0 00 13 41 03 '
        + encode21Bits(firmware.length)
        + ' ' + encode14Bits(checksum & 0x3fff)
        + ' f7');
}

function getHexFile() {
    $.get('mididata.hex', uploadFirmware);
}
