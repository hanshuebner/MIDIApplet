function encode7Bits(number) {
    return ((number & 0x7f)
            | 0x100)
        .toString(16).substr(-2, 2);
}
    
function encode14Bits(number) {
    return (((number & (0x7f << 7)) << 1)
            | (number & 0x7f)
            | 0x10000)
        .toString(16).substr(-4, 4);
}

function encode21Bits(number) {
    return (((number & (0x7f << 14)) << 2)
            | ((number & (0x7f << 7)) << 1)
            | (number & 0x7f)
            | 0x1000000)
        .toString(16).substr(-6, 6);
}

function encode28Bits(number) {
    return encode14Bits(number >> 14) + encode14Bits(number & 0x3fff);
}


// Little endian versions for MiniCommand

function encode14BitsLE(number) {
    return (((number & 0x7f) << 8)
            | ((number & (0x7f << 7)) >> 7)
            | 0x10000)
        .toString(16).substr(-4, 4);
}

function encode21BitsLE(number) {
    return (((number & 0x7f) << 16)
            | ((number & (0x7f << 7)) << 1)
            | ((number & (0x7f << 14)) >> 14)
            | 0x1000000)
        .toString(16).substr(-6, 6);
}

function encode28BitsLE(number) {
    return encode14BitsLE(number & 0x3fff) + encode14BitsLE(number >> 14);
}


function initMidiPortSelectors(inputSelectorName, outputSelectorName, applet, handlerName) {

    function showPorts(direction, ports) {
        for (var i = 0; i < ports.length; i++) {
            $('#' + direction + 'Select').append("<option>" + ports[i] + "</option>");
        }
    }
    
    showPorts('input', applet.getInputs());
    $('#' + inputSelectorName).change(function () {
        applet.openInput($(this).val(), handlerName);
        saveState($(this).attr('id'), $(this).val());
    });

    showPorts('output', applet.getOutputs());
    $('#' + outputSelectorName).change(function () {
        applet.openOutput($(this).val());
        saveState($(this).attr('id'), $(this).val());
    });
}

function matchMidiMessage(message) {
    for (var i = 1; i < arguments.length; i++) {
        var match = message.match(arguments[i]);
        if (match) {
            arguments[i+1].apply(this, match.slice(1));
            return;
        }
    }
}
            