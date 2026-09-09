package com.buzzer.timekeeper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BuzzerWidgetData")
public class BuzzerWidgetDataPlugin extends Plugin {
    @PluginMethod
    public void updateWidgets(PluginCall call) {
        WidgetDataStore.putString(getContext(), WidgetDataStore.KEY_ALARMS_TEXT, call.getString("alarmsText", "No alarms today."));
        WidgetDataStore.putString(getContext(), WidgetDataStore.KEY_NOTES_TEXT, call.getString("notesText", "No notes yet."));
        WidgetDataStore.putString(getContext(), WidgetDataStore.KEY_MARCUS_REPLY, call.getString("marcusReply", "Ask Marcus from the widget."));
        MarcusWidgetProvider.updateAll(getContext());
        TodayAlarmsWidgetProvider.updateAll(getContext());
        NotesWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getQuickNotes(PluginCall call) {
        String quickNotes = WidgetDataStore.getString(getContext(), WidgetDataStore.KEY_QUICK_NOTES_JSON, "[]");
        JSObject result = new JSObject();
        try {
            result.put("notes", new JSArray(quickNotes));
        } catch (Exception exception) {
            result.put("notes", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clearQuickNotes(PluginCall call) {
        WidgetDataStore.putString(getContext(), WidgetDataStore.KEY_QUICK_NOTES_JSON, "[]");
        call.resolve();
    }
}
