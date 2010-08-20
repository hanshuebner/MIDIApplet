
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
    // FIXME: This still contains some parsing code for DSI Tetra and some for BCx2000
    var match = message.match(/^b. (..) (..)/);
    if (match) {
        var byte1 = match[1];
        var byte2 = match[2];
        if (byte1 == "63") {
            parameterNumber = parseInt(byte2, 16) << 7;
            parameterValue = 0;
        } else if (byte1 == "62") {
            parameterNumber |= parseInt(byte2, 16);
        } else if (byte1 == "06") {
            parameterValue = parseInt(byte2, 16) << 7;
        } else if (byte1 == "26") {
            parameterValue |= parseInt(byte2, 16);
            addToLog(parameterNumber + " => " + parameterValue);
        } else {
            addToLog(message);
        }
        return;
    }
    var match = message.match(/^f0 01 26 02 .. .. (.*) f7 $/);
    if (match) {
        var data = decodeBinaryData(match[1]);
        addToLog("program dump: " + data);
        return;
    }
    var match = message.match(/^f0 00 20 32 00 15 20 (..) (..) (.*) f7 $/);
    if (match) {
        var lineNumber = (parseInt(match[1], 16) << 7) | parseInt(match[2], 16);
        var text = hexToString(match[3]);
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
        return;
    }
    var match = message.match(/^f0 00 20 32 00 15 21 (..) (..) (..) f7 $/);
    if (match) {
        var lineNumber = (parseInt(match[1], 16) << 7) | parseInt(match[2], 16);
        var status = match[3];
        if (parseInt(status, 16)) {
            addToLog("Error in line " + lineNumber);
        }
        return;
    }
    addToLog(message);
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
    
    function showPorts(direction, ports) {
        for (var i = 0; i < ports.length; i++) {
            $('#' + direction + 'Select').append("<option>" + ports[i] + "</option>");
        }
    }
    
    showPorts('input', applet.getInputs());
    $('#inputSelect').change(function () {
        applet.openInput($(this).val(), "midiMessageReceived");
        saveState($(this).attr('id'), $(this).val());
    });

    showPorts('output', applet.getOutputs());
    $('#outputSelect').change(function () {
        applet.openOutput($(this).val());
        saveState($(this).attr('id'), $(this).val());
        $('#submitConfig')
            .attr('disabled', '')
            .click(uploadConfiguration);
        $('#submitMessage')
            .click(sendMidiMessage);
    });

    restoreStateFromCookie();
});

