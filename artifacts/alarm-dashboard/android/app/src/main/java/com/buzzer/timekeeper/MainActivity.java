package com.buzzer.timekeeper;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BuzzerUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
