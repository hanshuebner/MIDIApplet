package net.bknr.midi;
import javax.sound.midi.*;

public class MidiInfo  {
    
    static public String[] getInputs() {
        return listDevices(false);
    }
    
    static public String[] getOutputs() {
        return listDevices(true);
    }

    static private String[] listDevices(boolean outputs)
    {
        String[] buf = new String[MidiSystem.getMidiDeviceInfo().length];
        int count = 0;
        for (MidiDevice.Info m : MidiSystem.getMidiDeviceInfo()) {
            try {
                MidiDevice dev = MidiSystem.getMidiDevice(m);
                if ((outputs ? dev.getMaxReceivers() : dev.getMaxTransmitters()) != 0) {
//                  System.out.println(m.getName());
                    buf[count++] = m.getName();
                }
            }
            catch (Exception e) {
                System.out.println("ERROR: Cannot determine MIDI device name for \"" + m + "\": " + e);
            }
        }
        String retval[] = new String[count];
        System.arraycopy(buf, 0, retval, 0, count);
        return retval;
    }
}
