package com.buzzer.timekeeper;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class NotesWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, NotesWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(provider);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Intent quickIntent = new Intent(context, QuickNoteActivity.class);
        quickIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent quickPendingIntent = PendingIntent.getActivity(context, appWidgetId + 30_000, quickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.notes_widget);
        views.setTextViewText(R.id.notes_widget_list, WidgetDataStore.getString(context, WidgetDataStore.KEY_NOTES_TEXT, "No notes yet."));
        views.setOnClickPendingIntent(R.id.notes_widget_root, quickPendingIntent);
        views.setOnClickPendingIntent(R.id.notes_widget_add, quickPendingIntent);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
