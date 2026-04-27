import { useState, useEffect } from 'react';

export interface MinutesData {
  id?: string;
  meetingId: string;
  meetingType: 'quick' | 'regular' | 'agm' | 'special';
  formData: Record<string, any>;
  attendees: Array<{ id: string; name: string; position: string }>;
  motions: Array<{
    id: string;
    description: string;
    mover: string;
    seconder: string;
    result: 'carried' | 'defeated' | 'tabled' | 'withdrawn' | '';
  }>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  approvedBy?: string;
  approvalDate?: string;
}

/**
 * Custom hook for managing meeting minutes
 * Handles CRUD operations and localStorage caching
 */
export const useMinutesManager = (meetingId: string) => {
  const [minutes, setMinutes] = useState<MinutesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load minutes from API or localStorage
  useEffect(() => {
    loadMinutes();
  }, [meetingId]);

  const loadMinutes = async () => {
    setLoading(true);
    setError(null);

    try {
      // First check localStorage for draft
      const localDraft = localStorage.getItem(`minutes-${meetingId}`);
      if (localDraft) {
        const draft = JSON.parse(localDraft);
        setMinutes(draft);
        setLoading(false);
        return;
      }

      // Then fetch from API
      const res = await fetch(`/api/minutes/${meetingId}`);
      if (res.ok) {
        const data = await res.json();
        setMinutes(data);
      } else if (res.status === 404) {
        // No minutes exist yet, that's ok
        setMinutes(null);
      } else {
        throw new Error('Failed to load minutes');
      }
    } catch (err) {
      console.error('Error loading minutes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load minutes');
    } finally {
      setLoading(false);
    }
  };

  const saveMinutes = async (data: Partial<MinutesData>) => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...data,
        meetingId,
      };

      // Save to localStorage first (instant feedback)
      localStorage.setItem(`minutes-${meetingId}`, JSON.stringify(payload));

      // Then save to API
      const res = await fetch(`/api/minutes/${meetingId}`, {
        method: minutes?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save minutes');
      }

      const saved = await res.json();
      setMinutes(saved);

      // Clear localStorage draft after successful save
      localStorage.removeItem(`minutes-${meetingId}`);

      return saved;
    } catch (err) {
      console.error('Error saving minutes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save minutes');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const deleteMinutes = async () => {
    if (!minutes?.id) return;

    try {
      const res = await fetch(`/api/minutes/${meetingId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete minutes');
      }

      setMinutes(null);
      localStorage.removeItem(`minutes-${meetingId}`);
    } catch (err) {
      console.error('Error deleting minutes:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete minutes');
      throw err;
    }
  };

  const approveMinutes = async (approvedBy: string) => {
    if (!minutes?.id) {
      throw new Error('Cannot approve unsaved minutes');
    }

    try {
      const res = await fetch(`/api/minutes/${meetingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy }),
      });

      if (!res.ok) {
        throw new Error('Failed to approve minutes');
      }

      const updated = await res.json();
      setMinutes(updated);
      return updated;
    } catch (err) {
      console.error('Error approving minutes:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve minutes');
      throw err;
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToJSON = () => {
    if (!minutes) return;

    const dataStr = JSON.stringify(minutes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minutes-${meetingId}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    minutes,
    loading,
    error,
    saving,
    saveMinutes,
    deleteMinutes,
    approveMinutes,
    exportToPDF,
    exportToJSON,
    refresh: loadMinutes,
  };
};

/**
 * Hook for listing all minutes
 */
export const useMinutesList = () => {
  const [minutesList, setMinutesList] = useState<MinutesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMinutesList();
  }, []);

  const loadMinutesList = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/minutes');
      if (!res.ok) {
        throw new Error('Failed to load minutes list');
      }

      const data = await res.json();
      setMinutesList(data);
    } catch (err) {
      console.error('Error loading minutes list:', err);
      setError(err instanceof Error ? err.message : 'Failed to load minutes list');
    } finally {
      setLoading(false);
    }
  };

  return {
    minutesList,
    loading,
    error,
    refresh: loadMinutesList,
  };
};

/**
 * Utility function to check if minutes need approval
 */
export const needsApproval = (minutes: MinutesData | null): boolean => {
  if (!minutes) return false;
  return !minutes.approvedBy && !minutes.approvalDate;
};

/**
 * Utility function to format minutes for display
 */
export const formatMinutesPreview = (minutes: MinutesData): string => {
  const { meetingType, formData } = minutes;
  const date = formData.meetingDate 
    ? new Date(formData.meetingDate).toLocaleDateString() 
    : 'No date';
  
  const typeLabel = {
    quick: 'Quick Meeting',
    regular: 'Board Meeting',
    agm: 'AGM',
    special: 'Special Meeting',
  }[meetingType] || meetingType;

  return `${typeLabel} - ${date}`;
};

/**
 * Utility function to get completion percentage
 */
export const getCompletionPercentage = (minutes: MinutesData): number => {
  const { formData, attendees, motions } = minutes;
  
  let totalFields = 0;
  let filledFields = 0;

  // Count filled form fields
  Object.values(formData).forEach(value => {
    totalFields++;
    if (value && value !== '') {
      filledFields++;
    }
  });

  // Check for attendees
  totalFields += 1;
  if (attendees.length > 0 && attendees[0].name) {
    filledFields += 1;
  }

  // Motions are optional, but count if present
  if (motions.length > 0) {
    motions.forEach(motion => {
      totalFields += 4; // description, mover, seconder, result
      if (motion.description) filledFields++;
      if (motion.mover) filledFields++;
      if (motion.seconder) filledFields++;
      if (motion.result) filledFields++;
    });
  }

  return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
};
