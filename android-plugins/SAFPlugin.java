package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "SAFFolderPicker")
public class SAFPlugin extends Plugin {

    private static final int REQUEST_CODE = 4242;
    private PluginCall savedCall;

    private static final Set<String> AUDIO_MIME_TYPES = new HashSet<>(Arrays.asList(
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
        "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4",
        "audio/x-m4a", "audio/ogg", "audio/webm"
    ));

    private static final Set<String> AUDIO_EXTENSIONS = new HashSet<>(Arrays.asList(
        "mp3", "wav", "flac", "aac", "m4a", "ogg", "webm"
    ));

    // =========================
    // Folder Picker
    // =========================
    @PluginMethod
    public void pickFolder(PluginCall call) {
        this.savedCall = call;

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);

        startActivityForResult(call, intent, REQUEST_CODE);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (savedCall == null) return;

        if (requestCode != REQUEST_CODE) return;

        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            savedCall.reject("Sélection de dossier annulée");
            savedCall = null;
            return;
        }

        Uri treeUri = data.getData();

        try {
            // Persist permission
            final int takeFlags = data.getFlags() &
                (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);

            // Get folder info
            DocumentFile folder = DocumentFile.fromTreeUri(getContext(), treeUri);
            String folderName = (folder != null && folder.getName() != null) ? folder.getName() : "Dossier";

            // Enumerate audio files
            JSArray filesArray = new JSArray();
            if (folder != null && folder.isDirectory()) {
                listAudioFiles(folder, filesArray);
            }

            JSObject ret = new JSObject();
            ret.put("folderUri", treeUri.toString());
            ret.put("folderName", folderName);
            ret.put("files", filesArray);

            savedCall.resolve(ret);
        } catch (Exception e) {
            savedCall.reject("SAF permission error: " + e.getMessage());
        } finally {
            savedCall = null;
        }
    }

    private void listAudioFiles(DocumentFile dir, JSArray filesArray) {
        for (DocumentFile file : dir.listFiles()) {
            if (file.isDirectory()) {
                // Recursive scan
                listAudioFiles(file, filesArray);
            } else if (file.isFile() && isAudioFile(file)) {
                JSObject fileObj = new JSObject();
                fileObj.put("uri", file.getUri().toString());
                fileObj.put("name", file.getName() != null ? file.getName() : "unknown");
                fileObj.put("mimeType", file.getType() != null ? file.getType() : "audio/*");
                fileObj.put("size", file.length());
                filesArray.put(fileObj);
            }
        }
    }

    private boolean isAudioFile(DocumentFile file) {
        // Check MIME type
        String mime = file.getType();
        if (mime != null && AUDIO_MIME_TYPES.contains(mime)) {
            return true;
        }
        // Fallback: check extension
        String name = file.getName();
        if (name != null) {
            int dot = name.lastIndexOf('.');
            if (dot > 0) {
                String ext = name.substring(dot + 1).toLowerCase();
                return AUDIO_EXTENSIONS.contains(ext);
            }
        }
        return false;
    }

    // =========================
    // Read File Content (base64)
    // =========================
    @PluginMethod
    public void readFileContent(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("URI is required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            InputStream is = getContext().getContentResolver().openInputStream(uri);
            if (is == null) {
                call.reject("Cannot open file");
                return;
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int len;
            while ((len = is.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            is.close();

            String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

            JSObject ret = new JSObject();
            ret.put("data", base64);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Read error: " + e.getMessage());
        }
    }

    // =========================
    // Rename Single File
    // =========================
    @PluginMethod
    public void renameFile(PluginCall call) {
        String uriStr = call.getString("uri");
        String newName = call.getString("newName");

        if (uriStr == null || newName == null) {
            call.reject("uri and newName are required");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            DocumentFile file = DocumentFile.fromSingleUri(getContext(), uri);

            if (file == null || !file.exists()) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "File not found");
                call.resolve(ret);
                return;
            }

            boolean ok = file.renameTo(newName);

            if (ok) {
                // MediaStore refresh
                triggerMediaScan(file.getUri());
            }

            JSObject ret = new JSObject();
            ret.put("success", ok);
            if (!ok) ret.put("error", "renameTo failed");
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // =========================
    // Batch Rename Files
    // =========================
    @PluginMethod
    public void renameFiles(PluginCall call) {
        try {
            String folderUriStr = call.getString("folderUri");
            List<JSObject> files = call.getArray("files").toList();

            Uri folderUri = Uri.parse(folderUriStr);
            Context context = getContext();

            DocumentFile folder = DocumentFile.fromTreeUri(context, folderUri);
            if (folder == null || !folder.isDirectory()) {
                call.reject("Invalid folder URI");
                return;
            }

            int successCount = 0;
            int failCount = 0;

            for (JSObject fileObj : files) {
                String oldName = fileObj.getString("oldName");
                String newName = fileObj.getString("newName");

                DocumentFile target = findFile(folder, oldName);
                if (target != null && target.exists()) {
                    boolean ok = target.renameTo(newName);
                    if (ok) {
                        successCount++;
                        triggerMediaScan(target.getUri());
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", failCount == 0);
            ret.put("renamed", successCount);
            ret.put("failed", failCount);
            call.resolve(ret);

        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // =========================
    // Utils
    // =========================
    private DocumentFile findFile(DocumentFile dir, String name) {
        for (DocumentFile file : dir.listFiles()) {
            if (file.isFile() && name.equals(file.getName())) {
                return file;
            }
            if (file.isDirectory()) {
                DocumentFile found = findFile(file, name);
                if (found != null) return found;
            }
        }
        return null;
    }

    private void triggerMediaScan(Uri fileUri) {
        try {
            Context context = getContext();
            String path = getPathFromUri(fileUri);
            if (path != null) {
                MediaScannerConnection.scanFile(
                    context,
                    new String[]{path},
                    null,
                    null
                );
            } else {
                // Fallback: broadcast
                Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                scanIntent.setData(fileUri);
                context.sendBroadcast(scanIntent);
            }
        } catch (Exception e) {
            // Non-blocking
        }
    }

    private String getPathFromUri(Uri uri) {
        try {
            String docId = DocumentsContract.getDocumentId(uri);
            if (docId != null && docId.contains(":")) {
                String[] parts = docId.split(":");
                String type = parts[0];
                String relativePath = parts.length > 1 ? parts[1] : "";
                if ("primary".equalsIgnoreCase(type)) {
                    return Environment.getExternalStorageDirectory() + "/" + relativePath;
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}
