package com.buzzer.timekeeper;

import android.app.Activity;
import android.os.Bundle;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import org.json.JSONArray;
import org.json.JSONObject;

public class QuickNoteActivity extends Activity {
    private EditText input;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_note);

        input = findViewById(R.id.quick_note_input);
        Button save = findViewById(R.id.quick_note_save);
        save.setOnClickListener(view -> saveNote());
        input.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                saveNote();
                return true;
            }
            return false;
        });

        input.requestFocus();
        input.postDelayed(() -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 250);
    }

    private void saveNote() {
        String content = input.getText().toString().trim();
        if (content.isEmpty()) return;

        try {
            JSONArray notes = new JSONArray(WidgetDataStore.getString(this, WidgetDataStore.KEY_QUICK_NOTES_JSON, "[]"));
            JSONObject note = new JSONObject();
            note.put("id", "quick-note-" + System.currentTimeMillis());
            note.put("content", content);
            note.put("createdAt", new java.util.Date().toInstant().toString());
            note.put("pinned", false);
            notes.put(note);
            WidgetDataStore.putString(this, WidgetDataStore.KEY_QUICK_NOTES_JSON, notes.toString());
            WidgetDataStore.putString(this, WidgetDataStore.KEY_NOTES_TEXT, "- " + content);
            NotesWidgetProvider.updateAll(this);
        } catch (Exception ignored) {
        }

        finish();
    }
}
