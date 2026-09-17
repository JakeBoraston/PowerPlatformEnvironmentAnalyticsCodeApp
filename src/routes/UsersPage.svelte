<script lang="ts">
  import { querystring } from 'svelte-spa-router';
  import { filterParam } from '$lib/utils/filterParam';
  import { isTruthy } from '$lib/utils/dataverse';
  import {
    users, usersLoading, usersError, userCount,
    activeUsers, disabledUsers, fetchUsers,
  } from '$lib/stores/userStore';
  import { formatDate } from '$lib/utils/dateUtils';
  import KpiCard from '$lib/components/KpiCard.svelte';
  import { Users as UsersIcon, UserCheck, UserX } from 'lucide-svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import LoadError from '$lib/components/ui/LoadError.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import SearchField from '$lib/components/ui/SearchField.svelte';
  import FilterSelect from '$lib/components/ui/FilterSelect.svelte';

  let isLoading = $derived($usersLoading);
  let error = $derived($usersError);

  // --- Filters ---
  let searchQuery = $state('');
  let statusFilter = $state<'all' | 'active' | 'disabled'>(
    filterParam($querystring, 'status', ['all', 'active', 'disabled'] as const, 'all')
  );

  let filteredUsers = $derived(
    $users.filter((user) => {
      const name = (user.fullname ?? '').toLowerCase();
      const email = (user.internalemailaddress ?? '').toLowerCase();
      const q = searchQuery.toLowerCase();
      if (q && !name.includes(q) && !email.includes(q)) return false;
      if (statusFilter === 'active' && isTruthy(user.isdisabled)) return false;
      if (statusFilter === 'disabled' && !isTruthy(user.isdisabled)) return false;
      return true;
    })
  );
</script>

<div class="flex flex-col gap-6 p-4 md:p-6 bg-base-100">
  <PageHeader
    title="Environment Users"
    subtitle="All users with access to this environment"
    refreshLabel="users"
    refreshing={isLoading}
    onRefresh={() => fetchUsers()}
  />

  <LoadError message={error} onRetry={() => fetchUsers()} />

  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <Spinner size="lg" label="Loading" />
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard label="Total Users" value={$userCount} icon={UsersIcon} />
      <KpiCard label="Active" value={$activeUsers.length} icon={UserCheck} />
      <KpiCard label="Disabled" value={$disabledUsers.length} icon={UserX} />
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-end gap-3">
      <SearchField placeholder="Search name or email…" bind:value={searchQuery} />
      <FilterSelect
        label="Status"
        options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active only' }, { value: 'disabled', label: 'Disabled only' }]}
        bind:value={statusFilter}
      />
      <span class="text-xs text-base-content/70 pb-2" aria-live="polite">{filteredUsers.length} of {$userCount} users</span>
    </div>

    {#if filteredUsers.length === 0}
      <div class="text-center text-base-content/70 py-12">
        <p class="text-sm">No users found.</p>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="overflow-x-auto pa-scroll pa-table-region" tabindex="0" role="region" aria-label="Users">
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th class="text-center">Status</th>
              <th>Created</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as user (user.systemuserid)}
              <tr class="hover:bg-base-200 transition-colors">
                <td class="font-medium">{user.fullname ?? (`${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() || '—')}</td>
                <td class="text-sm">{user.internalemailaddress ?? '—'}</td>
                <td class="text-center">
                  <span class="pa-pill {isTruthy(user.isdisabled) ? 'pa-pill--idle' : 'pa-pill--ok'}">
                    {isTruthy(user.isdisabled) ? 'Disabled' : 'Active'}
                  </span>
                </td>
                <td class="text-xs text-base-content/70">
                  {user.createdon ? formatDate(user.createdon) : '—'}
                </td>
                <td class="text-xs text-base-content/70">
                  {user.modifiedon ? formatDate(user.modifiedon) : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
