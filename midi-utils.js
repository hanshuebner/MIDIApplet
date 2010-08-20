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
    return encode14Bits(number >> 14) + encode14Bits(number & 0x2fff);
}

