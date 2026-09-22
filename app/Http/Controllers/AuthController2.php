<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('username', $credentials['username'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Username atau password salah.',
            ], 422);
        }

        Auth::login($user, true);
        $request->session()->regenerate();
        $sessionToken = Str::random(64);
        $request->session()->put('mc_active_session_token', $sessionToken);

        if (Schema::hasColumn('users', 'active_session_token')) {
            $user->forceFill(['active_session_token' => $sessionToken])->save();
        }

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
            'csrfToken' => csrf_token(),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $sessionToken = (string) $request->session()->get('mc_active_session_token', '');
        if ($user && Schema::hasColumn('users', 'active_session_token') && $sessionToken !== '' && hash_equals((string) ($user->active_session_token ?? ''), $sessionToken)) {
            $user->forceFill(['active_session_token' => null])->save();
        }

        Auth::guard('web')->logout();
        $request->session()->forget('mc_active_session_token');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['status' => 'success']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'user' => $request->user()?->publicProfile(),
            'csrfToken' => csrf_token(),
        ]);
    }

    public function users()
    {
        return response()->json([
            'status' => 'success',
            'data' => User::orderBy('role')->orderBy('username')->get()->map->publicProfile()->values(),
        ]);
    }

    public function saveUser(Request $request)
    {
        $actor = $request->user();
        $isOwner = $actor && strtolower((string)$actor->role) === 'owner';
        $isSuperAdmin = $actor && strtolower((string)$actor->role) === 'superadmin';

        abort_unless($isOwner || $isSuperAdmin, 403, 'Hanya owner atau superadmin yang boleh mengelola pengguna.');

        $id = $request->input('id');
        $validated = $request->validate([
            'id' => ['nullable', 'string', 'max:50'],
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->ignore($id, 'id'),
            ],
            'fullName' => ['required', 'string', 'max:150'],
            'role' => ['required', 'string', Rule::in(['owner', 'superadmin', 'admin', 'supervisor', 'kasir', 'teller', 'kurir', 'keamanan', 'papan', 'lainnya'])],
            'photo' => ['nullable', 'string', 'max:500'],
            'password' => [$id ? 'nullable' : 'required', 'string', 'min:6', 'max:255'],
        ]);

        if ($id) {
            $user = User::findOrFail($id);
            if (strtolower((string)$user->role) === 'owner' && !$isOwner) {
                abort(403, 'Anda tidak memiliki hak untuk mengubah akun owner.');
            }
        } else {
            $user = new User(['id' => 'u_' . now()->format('YmdHis') . '_' . substr(md5((string) microtime(true)), 0, 6)]);
        }

        if (strtolower((string)$validated['role']) === 'owner' && !$isOwner) {
            abort(403, 'Anda tidak memiliki hak untuk memberikan akses owner.');
        }

        $user->username = $validated['username'];
        $user->full_name = $validated['fullName'];
        $user->role = $validated['role'];
        $user->photo = $validated['photo'] ?? $user->photo;
        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }
        $user->save();

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
        ]);
    }

    public function updateMe(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->ignore($user->id, 'id'),
            ],
            'fullName' => ['required', 'string', 'max:150'],
            'photo' => ['nullable', 'string', 'max:500'],
            'password' => ['nullable', 'string', 'min:6', 'max:255'],
        ]);

        $user->username = $validated['username'];
        $user->full_name = $validated['fullName'];
        $user->photo = $validated['photo'] ?? $user->photo;
        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }
        $user->save();

        return response()->json([
            'status' => 'success',
            'user' => $user->publicProfile(),
        ]);
    }

    public function uploadFavicon(Request $request)
    {
        $request->validate([
            'favicon' => ['required', 'file', 'mimetypes:image/png', 'max:1024'],
        ], [
            'favicon.mimetypes' => 'Favicon harus berupa gambar PNG.',
            'favicon.max' => 'Ukuran favicon maksimal 1 MB.',
        ]);

        // A fixed, public PNG path keeps the browser link simple and avoids
        // storing executable/untrusted file formats in the web root.
        $request->file('favicon')->move(public_path(), 'favicon.png');

        return response()->json([
            'status' => 'success',
            'url' => asset('favicon.png') . '?v=' . now()->timestamp,
        ]);
    }

    public function deleteUser(Request $request, string $user)
    {
        $actor = $request->user();
        $isOwner = $actor && strtolower((string)$actor->role) === 'owner';
        $isSuperAdmin = $actor && strtolower((string)$actor->role) === 'superadmin';

        abort_unless($isOwner || $isSuperAdmin, 403, 'Hanya owner atau superadmin yang boleh menghapus pengguna.');
        abort_if($actor->id === $user, 422, 'Akun yang sedang login tidak boleh dihapus.');

        $targetUser = User::findOrFail($user);
        if (strtolower((string)$targetUser->role) === 'owner' && !$isOwner) {
            abort(403, 'Anda tidak memiliki hak untuk menghapus akun owner.');
        }

        $targetUser->delete();

        return response()->json(['status' => 'success']);
    }
}
