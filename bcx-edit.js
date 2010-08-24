
var applet;

var parameterNumber;
var parameterValue;

function decodeBinaryData(buf) {
    var retval = [];
    addToLog("length of data: " + buf.length);
    for (var i = 0; i < buf.length; i += 16) {
        var highBits = parseInt(buf.substr(i, 2), 16);
        for (j = 3; j < 16; j += 3) {
            retval.push(parseInt(buf.substr(i + j, 2), 16) + (highBits & 1) * 128);
        }
    }
    return retval;
}

function hexToString(buf) {
    var codes = [];
    for (var i = 0; i < buf.length; i += 3) {
        codes.push(parseInt(buf.substr(i, 2), 16));
    }
    return String.fromCharCode.apply(null, codes);
}

function stringToHex(buf) {
    var retval = '';
    for (var i = 0; i < buf.length; i++) {
        retval += (buf.charCodeAt(i) + 0x100).toString(16).substr(-2, 2) + ' ';
    }
    return retval;
}

var config = '';
var nextLineNumber = 0;

function midiMessageReceived(message) {
    matchMidiMessage(message,

                     /^f0 00 20 32 00 15 20 (..) (..) (.*) f7 $/,
                     function (lineNumberMSB, lineNumberLSB, hexEncodedString) {
                         var lineNumber = (parseInt(lineNumberMSB, 16) << 7) | parseInt(lineNumberLSB, 16);
                         var text = hexToString(hexEncodedString);
                         if (lineNumber != nextLineNumber) {
                             addToLog("line number error, wanted " + nextLineNumber + " got " + lineNumber);
                             nextLineNumber = lineNumber;
                         }
                         nextLineNumber++;
                         config += text + "\n";
                         if (text == '$end') {
                             $('#config').html(config);
                             config = '';
                             nextLineNumber = 0;
                         }
                     },

                     /^f0 00 20 32 00 15 21 (..) (..) (..) f7 $/,
                     function (lineNumberMSB, lineNumberLSB, status) {
                         var lineNumber = (parseInt(lineNumberMSB, 16) << 7) | parseInt(lineNumberLSB, 16);
                         if (parseInt(status, 16)) {
                             addToLog("Error in line " + lineNumber);
                         }
                     },

                     /(.*)/, function (message) {
                         addToLog("unmatched: " + message);
                     });
}

function uploadConfiguration()
{
    try {
        var lineNumber = 0;
        map(function (string) {
            applet.send('f0 00 20 32 00 15 20' + encode14Bits(lineNumber++) + stringToHex(string) + 'f7');
        }, $('#config').val().split(/\n/));
    }
    catch (e) {
        addToLog('error sending: ' + e);
    }
}

function sendMidiMessage()
{
    try {
        applet.send('f0 00 20 32 7f 7f ' + $('#midiMessage').val() + ' f7');
    }
    catch (e) {
        addToLog('error sending: ' + e);
    }
}

$(document).ready(function () {
    applet = document.applets[0];

    initMidiPortSelectors('inputSelect', 'outputSelect', applet, 'midiMessageReceived');
    
    $('#outputSelect').change(function () {
        $('#submitConfig')
            .attr('disabled', '')
            .click(uploadConfiguration);
        $('#submitMessage')
            .click(sendMidiMessage);
    });

    restoreStateFromCookie();
});

