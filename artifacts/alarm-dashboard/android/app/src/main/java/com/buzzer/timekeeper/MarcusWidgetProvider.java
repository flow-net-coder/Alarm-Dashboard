package com.buzzer.timekeeper;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class MarcusWidgetProvider extends AppWidgetProvider {
    static final String PREFS_NAME = "marcus_widget";
    static final String KEY_LAST_REPLY = "last_reply";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MarcusWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(provider);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void saveLastReply(Context context, String reply) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_REPLY, reply)
            .apply();
        updateAll(context);
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Intent quickIntent = new Intent(context, QuickMarcusActivity.class);
        quickIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent quickPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            quickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent appIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("buzzer://chat"));
        appIntent.setClass(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent appPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId + 10_000,
            appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String reply = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_REPLY, "Tap below to ask Marcus.");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.marcus_widget);
        views.setTextViewText(R.id.marcus_widget_reply, reply);
        views.setOnClickPendingIntent(R.id.marcus_widget_root, quickPendingIntent);
        views.setOnClickPendingIntent(R.id.marcus_widget_button, quickPendingIntent);
        views.setOnClickPendingIntent(R.id.marcus_widget_open_app, appPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
