
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
    return
        'f0 00 13 41 01 '
        + encode7Bits(length) + ' '
        + encode28Bits(offset) + ' '
        + ''.concat.apply('', map(encode7Bits, data.slice(offset, offset + length))) + ' '
        + encode7Bits(0) + ' ' // fixme checksum
        + 'f7';
}
    
    

function getHexFile() {
    $.get('mididata.hex', decodeHexFile);
}