package com.buzzer.timekeeper;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class TodayAlarmsWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, TodayAlarmsWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(provider);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("buzzer://alarms"));
        intent.setClass(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, appWidgetId + 20_000, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.today_alarms_widget);
        views.setTextViewText(R.id.today_alarms_widget_list, WidgetDataStore.getString(context, WidgetDataStore.KEY_ALARMS_TEXT, "No alarms today."));
        views.setOnClickPendingIntent(R.id.today_alarms_widget_root, pendingIntent);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
