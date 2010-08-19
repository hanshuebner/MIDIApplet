package net.bknr.midi;

import javax.sound.midi.*;

public class MidiOut extends MidiPort {

    public MidiOut(String deviceName)
    {
        super.port(deviceName);
        if (device != null) {
            try {
                receiver = device.getReceiver();
            }
            catch (MidiUnavailableException e) {
                error("Cannot get MIDI receiver: " + e);
                close();
            }
        }
    }

    @Override
    protected Direction getDirection()
    {
        return Direction.OUTPUT;
    }

    private enum State {
        IDLE, SYSEX, MSG1, MSG2
    };

    private State state = State.IDLE;

    RawMidiMessage message = new RawMidiMessage();
    Receiver receiver;

    protected void reopenDevice() {
        device.close();
        try {
            device.open();
            receiver = device.getReceiver();
        }
        catch (MidiUnavailableException e) {
            post("Cannot reopen MIDI device");
            device.close();
            device = null;
        }
    }

    // The Java MIDI library has a bug on Windows that results in Sysex messages to be always sent
    // with the length of the longest Sysex message that has been sent before.  Thus, if one ever
    // sends a long Sysex message to a device, the following messages will always be padded to the
    // length of that long message.  We work around this problem by recording the length of every
    // Sysex messages and reopening the MIDI port before sending a shorter Sysex message after a
    // longer one has been sent.  Note that the overhead can be significant when sending Sysex messages
    // of varying sizes.
    // See http://www.ucapps.de/jsynthlib.html for another workaround.  The method suggested there
    // has the disadvantage that the bandwidth of the MIDI port will be reduced as all messages sent
    // will be padded to the size of the largest message that has ever been sent.
    boolean onWindows = System.getProperty("os.name").startsWith("Windows");
    int lastSysexLength = 0;
    
    private void queue(int input)
    {
        input &= 0xff;
        // Put input byte into message buffer, flush to MIDI device if a message
        // end has been reached.
        message.addByte(input);
        switch (state) {
        case IDLE:
            if ((input & 0xF0) == 0xF0) {
                // system messages
                switch (input) {
                case 0xf0:
                    state = State.SYSEX;
                    break;
                case ShortMessage.SONG_POSITION_POINTER:
                    state = State.MSG2;
                    break;
                case ShortMessage.SONG_SELECT:
                    state = State.MSG1;
                    break;
                case ShortMessage.TUNE_REQUEST:
                default:
                    state = State.IDLE;
                }
            } else {
                // channel messages
                switch (input & 0xF0) {
                case ShortMessage.PROGRAM_CHANGE:
                case ShortMessage.CHANNEL_PRESSURE:
                    state = State.MSG1;
                    break;
                default:
                    state = State.MSG2;
                }
            }
            break;
        case MSG2:
            state = State.MSG1;
            break;
        case MSG1:
            state = State.IDLE;
            break;
        case SYSEX:
            if (input == 0xF7) {
                if (onWindows && (message.getLength() < lastSysexLength)) {
                    reopenDevice();
                }
                lastSysexLength = message.getLength();
                state = State.IDLE;
            }
        }
        if (state == State.IDLE) {
            if (device != null) {
                receiver.send(message, -1);
            }
            message.clear();
        }
    }

    public void send(byte[] data, int count) {
        for (int i = 0; i < count; i++) {
            queue(data[i]);
        }
    }
}
