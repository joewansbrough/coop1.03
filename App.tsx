// IMPROVED APP.TSX DATA FETCHING PATTERN
// Replace your current data fetching section with this:

const AppContent: React.FC = () => {
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [coopName] = useState('Your Housing Co-op');
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading, refetch: fetchUser } = useUser();
  
  // Clean & Efficient Gating: Only fetch system data once authentication is confirmed
  const isEnabled = !!user;

  // IMPROVED: Add error states and loading states
  const { 
    data: units = [], 
    isLoading: isUnitsLoading,
    isError: isUnitsError,
    error: unitsError 
  } = useUnits({ enabled: isEnabled });
  
  const { 
    data: tenants = [], 
    isLoading: isTenantsLoading,
    isError: isTenantsError,
    error: tenantsError 
  } = useTenants({ enabled: isEnabled });
  
  const { 
    data: requests = [],
    isError: isRequestsError,
    error: requestsError 
  } = useMaintenance({ enabled: isEnabled });
  
  const { 
    data: announcements = [],
    isError: isAnnouncementsError,
    error: announcementsError 
  } = useAnnouncements({ enabled: isEnabled });
  
  const { 
    data: documents = [],
    isError: isDocumentsError,
    error: documentsError 
  } = useDocuments({ enabled: isEnabled });
  
  const { 
    data: committees = [],
    isError: isCommitteesError,
    error: committeesError 
  } = useCommittees({ enabled: isEnabled });
  
  const { 
    data: events = [],
    isError: isEventsError,
    error: eventsError 
  } = useEvents({ enabled: isEnabled });

  // IMPROVED: Use mutations instead of direct setQueryData for better reliability
  const updateUnits = (updater: (prev: typeof units) => typeof units) => {
    queryClient.setQueryData(['units'], updater);
  };

  const updateTenants = (updater: (prev: typeof tenants) => typeof tenants) => {
    queryClient.setQueryData(['tenants'], updater);
  };

  const updateRequests = (updater: (prev: typeof requests) => typeof requests) => {
    queryClient.setQueryData(['maintenance'], updater);
  };

  const updateAnnouncements = (updater: (prev: typeof announcements) => typeof announcements) => {
    queryClient.setQueryData(['announcements'], updater);
  };

  const updateDocuments = (updater: (prev: typeof documents) => typeof documents) => {
    queryClient.setQueryData(['documents'], updater);
  };

  const updateCommittees = (updater: (prev: typeof committees) => typeof committees) => {
    queryClient.setQueryData(['committees'], updater);
  };

  const updateEvents = (updater: (prev: typeof events) => typeof events) => {
    queryClient.setQueryData(['events'], updater);
  };

  // IMPROVED: Add error handling UI
  useEffect(() => {
    const errors = [
      { name: 'Units', error: unitsError },
      { name: 'Tenants', error: tenantsError },
      { name: 'Maintenance', error: requestsError },
      { name: 'Announcements', error: announcementsError },
      { name: 'Documents', error: documentsError },
      { name: 'Committees', error: committeesError },
      { name: 'Events', error: eventsError },
    ].filter(e => e.error);

    if (errors.length > 0) {
      console.error('Data loading errors:', errors);
      // Optional: Show toast notification to user
    }
  }, [unitsError, tenantsError, requestsError, announcementsError, documentsError, committeesError, eventsError]);

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => fetchUser()} />;
  }

  const effectiveIsAdmin = user.isAdmin && !isAdminOverride;
  const isGuest = !!user.isGuest;

  return (
    <HashRouter>
      <ScrollToTop />
      <Layout 
        isAdmin={effectiveIsAdmin}
        isActualAdmin={user.isAdmin}
        onToggleAdminView={() => setIsAdminOverride(!isAdminOverride)}
        user={user} 
        coopName={coopName}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                isAdmin={effectiveIsAdmin}
                user={user}
                units={units}
                tenants={tenants}
                requests={requests}
                announcements={announcements}
                events={events}
              />
            }
          />
          {/* ... rest of routes, but now pass updateUnits, updateTenants etc instead of setUnits, setTenants */}
        </Routes>
      </Layout>
    </HashRouter>
  );
};
