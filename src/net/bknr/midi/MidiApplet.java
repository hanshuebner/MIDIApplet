package net.bknr.midi;

import netscape.javascript.*;
import java.applet.*;
import javax.sound.midi.*;


public class MidiApplet extends Applet implements Receiver {

    private static final long serialVersionUID = 3790589404250391760L;

    // Applet state
    String receiveCallback;
    MidiIn inputPort;
    MidiOut outputPort;

    // API used by JavaScript
    public String[] getInputs() {
        return MidiInfo.getInputs();
    }

    public String[] getOutputs() {
        return MidiInfo.getOutputs();
    }
    
    public void openInput(String name, String callback) {
        receiveCallback = callback;
        inputPort = new MidiIn(name, this);
    }
    
    public void openOutput(String name) {
        outputPort = new MidiOut(name);
    }

    // Applet methods
    JSObject window;
    public void init() {
        window = JSObject.getWindow(this);
        System.out.println("got window, all set");
    }
    
    public void destroy() {
        close();
    }
    
    // Midi Receiver methods
    
    // Receive MIDI bytes
    public void send(MidiMessage message, long timeStamp) {
        int length = message.getLength();
        byte bytes[] = message.getMessage();
        String out = "";
        for (int i = 0; i < length; i++) {
            // convert bytes to unsigned
            out += String.format("%02x ", bytes[i] & 0xff);
        }
        String args[] = new String[1];
        args[0] = out;
        window.call(receiveCallback, args);
    }
    
    // API to send Midi data
    public void send(String data) {
        if (outputPort != null) {
            byte buf[] = new byte[data.length() / 2];
            int outPointer = 0;
            int inPointer = 0;
            while (inPointer < data.length()) {
                if (Character.isWhitespace(data.charAt(inPointer))) {
                    inPointer++;
                } else {
                    buf[outPointer++] = (byte) (Integer.parseInt(data.substring(inPointer, inPointer + 2), 16) & 0xff);
                    inPointer += 2;
                }
            }
            outputPort.send(buf, outPointer);
        }
    }

    @Override
    public void close()
    {
        if (inputPort != null) {
            inputPort.close();
            inputPort = null;
        }
        if (outputPort != null) {
            outputPort.close();
            outputPort = null;
        }
    }
}
