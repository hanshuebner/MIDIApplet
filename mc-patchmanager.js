
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
        + encode28BitsLE(offset) + ' '
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
                           + encode21BitsLE(firmware.length)
                           + ' ' + encode14BitsLE(checksum & 0x3fff)
                           + ' f7');
    document.firmware.push('f0 00 13 41 04 f7');

    // Start boot loader.  It will send an ack which will in turn trigger the transfer.
    applet.send('f0 00 13 41 05 f7');
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
                         addToLog('NAK received from boot loader, update not successful');
                     },

                     /(.*)/, function (message) {
                         addToLog("unmatched: " + message);
                     });
}

function getPatches() {
    $.get('/patches/', function (data) {
        data = evalJSON(data);
        if (!data.patches) {
            addToLog('no patches returned from server');
            return;
        }
        data.patches.sort(function (a, b) {
            return a.title < b.title ? -1 : 1;
        });
        addToLog(data.patches.length + " patches received from server");
        var allTags = {};
        map(function (patch) {
            /* keep track of the tags that we have, for the tag list */
            map(function (tag) {
                allTags[tag]++;
            }, patch.tags || []);
            /* display entry for this patch in the patch list */
            function displayField(name) {
                return DIV({ class: name }, patch[name]);
            }
            var element = DIV({ class: 'patch' },
                              map(displayField, ['title', 'author', 'last-modified-date']),
                              DIV({ class: 'tags' },
                                  map(partial(DIV, { class: 'tag' }), patch.tags || [])),
                              displayField('comment'));
            /* back pointer for click handler */
            element.patch = patch;
            $('#patches').append(
                $(element)
                    .mouseenter(function() {
                        $(this).addClass('patchHighlight');
                    })
                    .mouseleave(function() {
                        $(this).removeClass('patchHighlight');
                    })
                    .click(patchDetails));
        }, data.patches);

        function tagClicked(event) {
            if (event) {
                event.preventDefault();
            }

            $(this).toggleClass('selectedTag');

            /* hide all patches in the patch list that do not have the selected tags */
            var selectedTags = [];
            $(this).parent().find('.tag').each(function (index, element) {
                if ($(element).hasClass('selectedTag')) {
                    selectedTags.push(this.tag);
                }
            });
            var matched = 0;
            $('#patches').children().each(function (index, element) {
                var show = true;
                if (selectedTags.length) {
                    for (var i in selectedTags) {
                        if (findValue(element.patch.tags || [], selectedTags[i]) == -1) {
                            show = false
                            break;
                        }
                    }
                }
                if (show) {
                    matched++;
                    $(element).show();
                } else {
                    $(element).hide();
                }
            });
            addToLog(matched + ' patches match');
        }

        /* create the tag list for searches */
        $('#tags').empty();

        allTags = keys(allTags);
        allTags.sort();
        map(function (tag) {
            var element = BUTTON({ class: 'tag' }, tag);
            element.tag = tag;
            $('#tags').append($(element).click(tagClicked));
        }, allTags);
    });
}

function uploadPatch()
{
    /* find the patch that we're currently displaying */
    var patch = $(this).parent().parent().parent()[0].patch;
    addToLog('uploading patch with ' + patch.title);
    try {
        uploadFirmware(patch['hex-data']);
        addToLog('patch uploaded');
    }
    catch (e) {
        addToLog('error uploading firmware: ' + e);
    }
}

function patchDetails(event)
{
    if (event) {
        event.preventDefault();
    }

    /* mask out the background */
    $('#ajax-loader')
        .css('top',  $(window).height() / 2 - $('#ajax-loader').height() / 2)
        .css('left', $(window).width() / 2 - $('#ajax-loader').width() / 2);
    $('#mask')
        .click(function () {
            $(this).fadeOut(200);
            $('.modal-window').fadeOut(200);
        })
        .css({ 'width': $(window).width(),
               'height': $(document).height()})
        .fadeIn(200)
        .fadeTo("slow", 0.8);

    /* get and display the patch details */
    $.get('/patches/' + this.patch.id, function (data) {
        var patch = evalJSON(data);

        if (patch.documentation) {
            /* set up documentation window */
            $('#show-documentation')
                .show()
                .click(function () {
                    $('#documentation')
                        .empty()
                        .append($(PRE(null, patch.documentation)));
                    $('#documentation-window')
                        .css('max-height', Math.round($(window).height() * 0.8))
                        .css('top',  $(window).height() / 2 - $('#documentation-window').height() / 2)
                        .css('left', $(window).width() / 2 - $('#documentation-window').width() / 2)
                        .show();
                });
        } else {
            /* no docs, hide documentation button */
            $('#show-documentation')
                .hide();
        }

        /* display patch details */
        function displayField(name) {
            return DIV({ class: name },
                       patch[name]);
        }
        $('#patch-details')
            .empty()
            .append($(DIV({ class: 'patch' },
                          map(displayField, ['title', 'author', 'last-modified-date']),
                          displayField('comment'))));
        $('#upload-window')[0].patch = patch;
        $('#upload-window')
            .css('top',  $(window).height() / 2 - $('#upload-window').height() / 2)
            .css('left', $(window).width() / 2 - $('#upload-window').width() / 2)
            .fadeIn(200);
    });
}

$(document).ready(function () {
    applet = document.applets[0];

    document.firmware = [];

    initMidiPortSelectors('inputSelect', 'outputSelect', applet, 'midiMessageReceived');

    /* connect the MIDI port selectors and the upload button (no upload possible until ports have been selected */
    function maybeEnableUpload() {
        $('#upload-button').attr('disabled',
                                 ($('#inputSelect').val() && $('#outputSelect').val()) ? '' : 'disabled');
    }
    
    $('#inputSelect').change(maybeEnableUpload);
    $('#outputSelect').change(maybeEnableUpload);
    $('#upload-button').click(uploadPatch);

    /* initialize close icons of modal windows */
    $('.close-window-icon').click(function () {
        $(this).parent().fadeOut(100);
        if ($(this).parent().attr('top')) {
            $('#mask').fadeOut(100);
        }
    });

    restoreStateFromCookie();

    getPatches();
});
