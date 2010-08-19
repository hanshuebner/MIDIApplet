package net.bknr.midi;

import javax.sound.midi.MidiMessage;

public class RawMidiMessage extends MidiMessage {

    protected RawMidiMessage(byte[] data) {
        super(data);
    }

    private static final int BUF_SIZE = 512;

    public RawMidiMessage() {
        this(new byte[BUF_SIZE]);
        length = 0;
    }

    @Override
    public Object clone() {
        byte message[] = new byte[length];
        System.arraycopy(data, 0, message, 0, length);
        return new RawMidiMessage(message);
    }

    public void addByte(int b) {
        // FIXME - should increase buffer size eventually
        data[length] = (byte) (b & 0xff);
        length++;
    }

    public void clear() {
        length = 0;
    }
}
