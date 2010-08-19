package net.bknr.midi;

import javax.sound.midi.MidiDevice;
import javax.sound.midi.MidiSystem;

public abstract class MidiPort {
    protected MidiDevice device = null;
    
    protected void post(String message) {
        System.out.println(message);
    }
    
    protected void error(String message) {
        System.out.println("ERROR: " + message);
    }

    public void bang()
    {
        if (device != null) {
            MidiDevice.Info info = device.getDeviceInfo();
            post("Java MIDI alive, " + getDirection() + " device \"" + info + "\" open");
        } else {
            post("Java MIDI alive, no device open");
        }
    }

    public enum Direction {
        INPUT, OUTPUT
    };

    // return direction of the physical port
    abstract protected Direction getDirection();

    public void port(String name)
    {
        close();
        for (MidiDevice.Info m : MidiSystem.getMidiDeviceInfo()) {
            try {
                MidiDevice dev = MidiSystem.getMidiDevice(m);
                if (m.getName().startsWith(name)
                    && ((getDirection() == Direction.OUTPUT) ? dev.getMaxReceivers() : dev.getMaxTransmitters()) != 0) {
                    dev.open();
                    device = dev;
                    break;
                }
            }
            catch (Exception e) {
                error("Couldn't open MIDI " + getDirection() + " device \"" + m.getName() + "\": " + e);
            }
        }
        if (device == null) {
            error("Could not find MIDI input device that matches name \"" + name + "\"");
        } else {
            bang();
        }
    }

    public void close()
    {
        try {
            if (device != null) {
                device.close();
            }
        }
        catch (Exception e) {
            error("Couldn't close MIDI device: " + e);
        }
        device = null;
    }
}
