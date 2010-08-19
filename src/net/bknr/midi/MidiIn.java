package net.bknr.midi;
import javax.sound.midi.*;

public class MidiIn extends MidiPort
{
    public MidiIn(String deviceName, Receiver receiver)
    {
        super.port(deviceName);
        if (device != null) {
            try {
                device.getTransmitter().setReceiver(receiver);
            } 
            catch (MidiUnavailableException e) {
                error("Cannot set up MIDI receiver: " + e);
                close();
            }
        }
    }

    @Override
    protected Direction getDirection() {
        return Direction.INPUT;
    }
}
