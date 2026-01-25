<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\User;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('roles') || !Schema::hasTable('permissions')) {
            return;
        }

        $roles = DB::table('roles')->get();
        foreach ($roles as $role) {
            $permissions = [];
            if (!empty($role->permissions)) {
                $decoded = json_decode($role->permissions, true);
                if (is_array($decoded)) {
                    foreach ($decoded as $key => $value) {
                        if ($value === true) {
                            $permissions[] = $key;
                        }
                    }
                }
            }

            if (!empty($permissions)) {
                $permModels = collect($permissions)
                    ->map(fn ($name) => Permission::findOrCreate($name, 'web'));

                foreach ($permModels as $perm) {
                    DB::table('role_has_permissions')->updateOrInsert([
                        'permission_id' => $perm->id,
                        'role_id' => $role->id,
                    ], []);
                }
            }
        }

        if (Schema::hasColumn('users', 'role_id')) {
            $users = User::query()->get();
            foreach ($users as $user) {
                if ($user->role_id) {
                    $role = DB::table('roles')->where('id', $user->role_id)->first();
                    if ($role) {
                        DB::table('model_has_roles')->updateOrInsert([
                            'role_id' => $user->role_id,
                            'model_type' => User::class,
                            'model_id' => $user->id,
                            'tenant_id' => $user->tenant_id,
                        ], []);
                    }
                }
            }
        }
    }

    public function down(): void
    {
        // No rollback for data migration.
    }
};
