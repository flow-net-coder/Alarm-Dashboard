package com.buzzer.timekeeper;

import android.app.Activity;
import android.os.Bundle;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class QuickMarcusActivity extends Activity {
    private static final String CHAT_URL = "https://flow-net-web-production.up.railway.app/api/chat";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText input;
    private TextView reply;
    private Button send;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_marcus);

        input = findViewById(R.id.quick_marcus_input);
        reply = findViewById(R.id.quick_marcus_reply);
        send = findViewById(R.id.quick_marcus_send);

        String lastReply = getSharedPreferences(MarcusWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(MarcusWidgetProvider.KEY_LAST_REPLY, "Latest reply will show here.");
        reply.setText(lastReply);

        send.setOnClickListener(view -> sendMessage());
        input.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendMessage();
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

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private void sendMessage() {
        String text = input.getText().toString().trim();
        if (text.isEmpty()) return;

        send.setEnabled(false);
        reply.setText("Marcus is thinking...");

        executor.execute(() -> {
            try {
                String response = postChat(text);
                JSONObject json = new JSONObject(response);
                String answer = json.optString("reply", "Marcus replied, but the message was empty.");
                MarcusWidgetProvider.saveLastReply(this, answer);
                runOnUiThread(() -> {
                    reply.setText(answer);
                    input.setText("");
                    send.setEnabled(true);
                });
            } catch (Exception exception) {
                String message = exception.getMessage() != null ? exception.getMessage() : "Could not reach Marcus.";
                runOnUiThread(() -> {
                    reply.setText(message);
                    send.setEnabled(true);
                });
            }
        });
    }

    private String postChat(String text) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(CHAT_URL).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);

        JSONObject body = new JSONObject();
        body.put("message", text);
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }

        int status = connection.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
            status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(),
            StandardCharsets.UTF_8
        ));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        connection.disconnect();

        if (status < 200 || status >= 300) {
            throw new Exception("Marcus API error " + status);
        }
        return builder.toString();
    }
}
