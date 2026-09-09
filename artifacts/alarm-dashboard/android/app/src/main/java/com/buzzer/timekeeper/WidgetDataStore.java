package com.buzzer.timekeeper;

import android.content.Context;

class WidgetDataStore {
    static final String PREFS_NAME = "buzzer_widgets";
    static final String KEY_MARCUS_REPLY = "marcus_reply";
    static final String KEY_ALARMS_TEXT = "alarms_text";
    static final String KEY_NOTES_TEXT = "notes_text";
    static final String KEY_QUICK_NOTES_JSON = "quick_notes_json";

    static String getString(Context context, String key, String fallback) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(key, fallback);
    }

    static void putString(Context context, String key, String value) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(key, value)
            .apply();
    }
}
