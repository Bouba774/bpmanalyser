package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "SAFFolderPicker")
public class SAFPlugin extends Plugin {

    private static final Set<String> AUDIO_EXTENSIONS = new HashSet<>(Arrays.asList(
        "mp3", "wav", "flac", "aac", "m4a", "ogg", "wma", "aiff", "alac"
    ));

    // =========================
    // Folder Picker
    // =========================
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            return;
        }

        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            call.reject("Sélection annulée");
            return;
        }

        Intent data = activityResult.getData();
        if (data == null || data.getData() == null) {
            call.reject("Sélection annulée");
            return;
        }

        Uri treeUri = data.getData();
        Context context = getContext();

        try {
            // Persist permission
            context.getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );

            DocumentFile folder = DocumentFile.fromTreeUri(context, treeUri);
            if (folder == null || !folder.isDirectory()) {
                call.reject("URI invalide ou pas un dossier");
                return;
            }

            String folderName = folder.getName() != null ? folder.getName() : "Dossier";

            // List audio files
            JSArray filesArray = new JSArray();
            listAudioFiles(folder, filesArray);

            JSObject ret = new JSObject();
            ret.put("folderUri", treeUri.toString());
            ret.put("folderName", folderName);
            ret.put("files", filesArray);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Erreur SAF: " + e.getMessage());
        }
    }

    private void listAudioFiles(DocumentFile dir, JSArray filesArray) {
        if (dir == null) return;
        for (DocumentFile file : dir.listFiles()) {
            if (file.isDirectory()) {
                listAudioFiles(file, filesArray);
            } else if (file.isFile() && isAudioFile(file.getName())) {
                JSObject fileObj = new JSObject();
                fileObj.put("uri", file.getUri().toString());
                fileObj.put("name", file.getName());
                fileObj.put("mimeType", file.getType() != null ? file.getType() : "audio/*");
                fileObj.put("size", file.length());
                filesArray.put(fileObj);
            }
        }
    }

    private boolean isAudioFile(String name) {
        if (name == null) return false;
        int dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        String ext = name.substring(dot + 1).toLowerCase();
        return AUDIO_EXTENSIONS.contains(ext);
    }

    // =========================
    // Read File Content (Base64)
    // =========================
    @PluginMethod
    public void readFileContent(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("URI manquante");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            Context context = getContext();
            InputStream is = context.getContentResolver().openInputStream(uri);
            if (is == null) {
                call.reject("Impossible d'ouvrir le fichier");
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
            call.reject("Erreur lecture: " + e.getMessage());
        }
    }

    // =========================
    // Rename File
    // =========================
    @PluginMethod
    public void renameFile(PluginCall call) {
        String uriStr = call.getString("uri");
        String newName = call.getString("newName");

        if (uriStr == null || newName == null) {
            call.reject("URI ou nouveau nom manquant");
            return;
        }

        try {
            Uri uri = Uri.parse(uriStr);
            Context context = getContext();

            // Use DocumentsContract.renameDocument which works with SAF tree permissions
            Uri renamedUri = DocumentsContract.renameDocument(
                context.getContentResolver(), uri, newName
            );

            boolean ok = (renamedUri != null);

            if (ok) {
                // MediaStore refresh
                String path = getPathFromUri(context, renamedUri);
                if (path != null) {
                    MediaScannerConnection.scanFile(context, new String[]{path}, null, null);
                } else {
                    Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                    scanIntent.setData(renamedUri);
                    context.sendBroadcast(scanIntent);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", ok);
            if (ok) {
                ret.put("newUri", renamedUri.toString());
            } else {
                ret.put("error", "Renommage échoué");
            }
            call.resolve(ret);

        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // =========================
    // Rename Files (batch)
    // =========================
    @PluginMethod
    public void renameFiles(PluginCall call) {
        try {
            String folderUriStr = call.getString("folderUri");
            JSArray filesArr = call.getArray("files");

            if (folderUriStr == null || filesArr == null) {
                call.reject("folderUri et files requis");
                return;
            }

            Uri folderUri = Uri.parse(folderUriStr);
            Context context = getContext();
            DocumentFile folder = DocumentFile.fromTreeUri(context, folderUri);

            if (folder == null || !folder.isDirectory()) {
                call.reject("Dossier invalide");
                return;
            }

            for (int i = 0; i < filesArr.length(); i++) {
                JSObject fileObj = JSObject.fromJSONObject(filesArr.getJSONObject(i));
                String oldName = fileObj.getString("oldName");
                String newName = fileObj.getString("newName");

                DocumentFile target = findFile(folder, oldName);
                if (target != null && target.exists()) {
                    boolean ok = target.renameTo(newName);
                    if (ok) {
                        Uri renamedUri = target.getUri();
                        String path = getPathFromUri(context, renamedUri);
                        if (path != null) {
                            MediaScannerConnection.scanFile(context, new String[]{path}, null, null);
                        } else {
                            Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                            scanIntent.setData(renamedUri);
                            context.sendBroadcast(scanIntent);
                        }
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
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
        }
        return null;
    }

    private String getPathFromUri(Context context, Uri uri) {
        try {
            String docId = DocumentsContract.getDocumentId(uri);
            String[] split = docId.split(":");
            String type = split[0];
            String relativePath = split.length > 1 ? split[1] : "";

            if ("primary".equalsIgnoreCase(type)) {
                return Environment.getExternalStorageDirectory() + "/" + relativePath;
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}
