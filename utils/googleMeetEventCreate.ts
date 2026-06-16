type SyncCreatedEventInput<TEvent extends { id: string }, TSyncedEvent extends TEvent = TEvent> = {
  event: TEvent;
  shouldCreateMeet: boolean;
  syncEvent: (eventId: string) => Promise<{
    event?: TSyncedEvent;
    hangoutLink?: string | null;
    htmlLink?: string | null;
  }>;
};

export const syncCreatedEventToGoogleMeet = async <TEvent extends { id: string }, TSyncedEvent extends TEvent = TEvent>({
  event,
  shouldCreateMeet,
  syncEvent,
}: SyncCreatedEventInput<TEvent, TSyncedEvent>) => {
  if (!shouldCreateMeet) {
    return {
      event,
      synced: false,
    };
  }

  try {
    const result = await syncEvent(event.id);
    const syncedEvent = result.event || event;
    return {
      event: syncedEvent,
      synced: true,
      meetLink: result.hangoutLink || (syncedEvent as any).googleMeetLink || null,
      calendarLink: result.htmlLink || (syncedEvent as any).googleCalendarHtmlLink || null,
    };
  } catch (error) {
    return {
      event,
      synced: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
